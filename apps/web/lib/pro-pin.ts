/*
 * FILE    : apps/web/lib/pro-pin.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-13_0030 UTC
 * PURPOSE : The Pro PIN — an extra lock on a job's street address, customer contact and entry details. Nobody sees an
 *           address before accepting a job; after accepting, the pro also enters their personal 4–6 digit PIN on the
 *           device (once per 12 hours) to see it, so a lost or shared phone doesn't give away customers' homes.
 *             • the PIN is stored hashed (scrypt + salt), never in plain text
 *             • 5 wrong tries → locked for 15 minutes, staff alerted
 *             • a right PIN unlocks the device for 12 hours: an httpOnly cookie on the web, a token the app keeps in
 *               the phone's secure storage and sends as the x-pro-unlock header
 *             • "Forgot PIN": a 30-minute reset link to the pro's email; staff can also reset it (Hub → Pros)
 *           Until supabase/setup/ADD_PRO_PIN_2026-11-13_0030.sql is run the lock is off (nobody is locked out).
 */
import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { BRAND } from "@handled/core";
import { adminClient } from "./supabase/server";
import { raiseAlert } from "./jobs";
import { sendEmail, siteUrl } from "./notify";

const db = () => adminClient();
export const PIN_COOKIE = "h_pro_pin";
export const PIN_HEADER = "x-pro-unlock";
export const PIN_RULES = { unlockHours: 12, maxTries: 5, lockMinutes: 15, resetMinutes: 30 } as const;

const secret = () => {
  const k = process.env.PRO_PIN_SECRET || process.env.INVOICE_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (k) return k;
  if (process.env.NODE_ENV === "production") throw new Error("PRO_PIN_SECRET (or SUPABASE_SERVICE_ROLE_KEY) must be set");
  return "dev-only-secret";
};
const sign = (s: string) => createHmac("sha256", secret()).update(`pro-pin:${s}`).digest("base64url").slice(0, 32);
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export const validPinFormat = (pin: unknown): pin is string => typeof pin === "string" && /^\d{4,6}$/.test(pin) && !/^(\d)\1+$/.test(pin) && !["1234", "12345", "123456", "4321", "654321"].includes(pin);

function hashPin(pin: string) {
  const salt = randomBytes(16).toString("base64url");
  return `${salt}:${scryptSync(pin, salt, 32).toString("base64url")}`;
}
function pinMatches(pin: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  return same(scryptSync(pin, salt, 32).toString("base64url"), hash);
}

type PinRow = { id: string; email: string; business_name: string; pin_hash: string | null; pin_set_at: string | null; pin_failed: number | null; pin_locked_until: string | null };

/** The pro's PIN record; null when the PIN SQL hasn't been run (the lock is off). */
async function pinRow(contractorId: string): Promise<PinRow | null> {
  const { data, error } = await db().from("contractors").select("id, email, business_name, pin_hash, pin_set_at, pin_failed, pin_locked_until").eq("id", contractorId).maybeSingle();
  if (error || !data) return null;
  return data as PinRow;
}

/** Is the PIN lock on, and has this pro set a PIN? */
export async function pinStatus(contractorId: string): Promise<{ enabled: boolean; set: boolean; lockedUntil: string | null }> {
  const r = await pinRow(contractorId);
  if (!r) return { enabled: false, set: false, lockedUntil: null };
  return { enabled: true, set: Boolean(r.pin_hash), lockedUntil: r.pin_locked_until && new Date(r.pin_locked_until) > new Date() ? r.pin_locked_until : null };
}

/** A 12-hour unlock for this pro, tied to the PIN they have now (changing the PIN ends every old unlock). */
function unlockToken(contractorId: string, pinSetAt: string | null) {
  const exp = Date.now() + PIN_RULES.unlockHours * 3600000;
  return `${contractorId}.${exp}.${sign(`${contractorId}:${exp}:${pinSetAt ?? ""}`)}`;
}
function tokenValid(token: string | null | undefined, contractorId: string, pinSetAt: string | null) {
  if (!token) return false;
  const [cid, exp, sig] = token.split(".");
  if (cid !== contractorId || !exp || !sig || Number(exp) < Date.now()) return false;
  return same(sig, sign(`${cid}:${exp}:${pinSetAt ?? ""}`));
}

/**
 * May this device see the pro's addresses and customer details right now? True when the lock is off (SQL not run),
 * or the device holds a valid unlock (cookie on the web, x-pro-unlock header from the app). A pro with no PIN yet is
 * locked: they create one first.
 */
export async function pinUnlocked(contractorId: string, req?: Request | null): Promise<boolean> {
  const r = await pinRow(contractorId);
  if (!r) return true;
  if (!r.pin_hash) return false;
  let token = req?.headers.get(PIN_HEADER) ?? null;
  if (!token) {
    try { token = (await cookies()).get(PIN_COOKIE)?.value ?? null; } catch { token = null; }
  }
  return tokenValid(token, contractorId, r.pin_set_at);
}

const cookieHeader = (token: string) => `${PIN_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${PIN_RULES.unlockHours * 3600}`;

/** Create or change the PIN (no PIN yet, the current PIN, or a reset link). Returns the unlock token. */
export async function setPin(contractorId: string, pin: string, o: { current?: string | null; resetToken?: string | null } = {}): Promise<{ ok: true; token: string; cookie: string } | { ok: false; error: string }> {
  if (!validPinFormat(pin)) return { ok: false, error: "Use 4–6 digits, not all the same and not 1234." };
  const r = await pinRow(contractorId);
  if (!r) return { ok: false, error: "The PIN lock isn't switched on yet." };
  if (r.pin_hash) {
    const byReset = o.resetToken ? validResetToken(o.resetToken, contractorId, r.pin_set_at) : false;
    const byCurrent = o.current ? pinMatches(o.current, r.pin_hash) : false;
    if (!byReset && !byCurrent) return { ok: false, error: o.resetToken ? "That reset link has expired. Ask for a new one." : "Enter your current PIN to change it." };
  }
  const at = new Date().toISOString();
  const { error } = await db().from("contractors").update({ pin_hash: hashPin(pin), pin_set_at: at, pin_failed: 0, pin_locked_until: null }).eq("id", contractorId);
  if (error) return { ok: false, error: "Couldn't save your PIN. Try again." };
  const token = unlockToken(contractorId, at);
  return { ok: true, token, cookie: cookieHeader(token) };
}

/** Enter the PIN to unlock this device for 12 hours. Five wrong tries lock it for 15 minutes (staff alerted). */
export async function unlockWithPin(contractorId: string, pin: string): Promise<{ ok: true; token: string; cookie: string } | { ok: false; error: string; lockedUntil?: string }> {
  const r = await pinRow(contractorId);
  if (!r) return { ok: false, error: "The PIN lock isn't switched on yet." };
  if (!r.pin_hash) return { ok: false, error: "Create your PIN first." };
  if (r.pin_locked_until && new Date(r.pin_locked_until) > new Date()) return { ok: false, error: `Too many tries. Try again after ${new Date(r.pin_locked_until).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}, or reset your PIN by email.`, lockedUntil: r.pin_locked_until };
  if (typeof pin !== "string" || !pinMatches(pin, r.pin_hash)) {
    const failed = Number(r.pin_failed ?? 0) + 1;
    const lock = failed >= PIN_RULES.maxTries;
    const until = lock ? new Date(Date.now() + PIN_RULES.lockMinutes * 60000).toISOString() : null;
    await db().from("contractors").update({ pin_failed: lock ? 0 : failed, pin_locked_until: until }).eq("id", contractorId);
    if (lock) await raiseAlert("security", "warn", `${r.business_name}: Pro PIN locked after ${PIN_RULES.maxTries} wrong tries`, `Locked for ${PIN_RULES.lockMinutes} minutes. If the pro didn't do this, their phone or account may be in someone else's hands — call them.`).catch(() => {});
    return lock ? { ok: false, error: `Too many tries — locked for ${PIN_RULES.lockMinutes} minutes. You can reset your PIN by email.`, lockedUntil: until! } : { ok: false, error: `Wrong PIN. ${PIN_RULES.maxTries - failed} tr${PIN_RULES.maxTries - failed === 1 ? "y" : "ies"} left.` };
  }
  await db().from("contractors").update({ pin_failed: 0, pin_locked_until: null }).eq("id", contractorId);
  const token = unlockToken(contractorId, r.pin_set_at);
  return { ok: true, token, cookie: cookieHeader(token) };
}

function resetToken(contractorId: string, pinSetAt: string | null) {
  const exp = Date.now() + PIN_RULES.resetMinutes * 60000;
  return `${exp}.${sign(`reset:${contractorId}:${exp}:${pinSetAt ?? ""}`)}`;
}
function validResetToken(token: string, contractorId: string, pinSetAt: string | null) {
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return same(sig, sign(`reset:${contractorId}:${exp}:${pinSetAt ?? ""}`));
}

/** "Forgot PIN": a 30-minute link to the pro's email (they also need to be signed in to use it). */
export async function sendPinReset(contractorId: string): Promise<{ ok: boolean; error?: string }> {
  const r = await pinRow(contractorId);
  if (!r) return { ok: false, error: "The PIN lock isn't switched on yet." };
  const link = `${siteUrl()}/pro/pin?reset=${encodeURIComponent(resetToken(contractorId, r.pin_set_at))}`;
  const sent = await sendEmail(r.email, `Reset your ${BRAND.name} Pro PIN`,
    `Someone asked to reset the Pro PIN on your ${BRAND.name} account. If it was you, set a new PIN here within ${PIN_RULES.resetMinutes} minutes:\n\n${link}\n\nIf it wasn't you, ignore this email and call us at ${BRAND.supportPhone} — your PIN stays the same.\n\n— ${BRAND.name}`).catch(() => false);
  return sent ? { ok: true } : { ok: false, error: "Couldn't send the email. Call us and we'll reset it." };
}

/** Staff (Hub → Pros): clear the PIN; the pro creates a new one the next time they open a job. */
export async function staffResetPin(contractorId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await db().from("contractors").update({ pin_hash: null, pin_set_at: null, pin_failed: 0, pin_locked_until: null }).eq("id", contractorId);
  return error ? { ok: false, error: /pin_hash/.test(error.message) ? "Run the Pro PIN SQL first." : error.message } : { ok: true };
}

