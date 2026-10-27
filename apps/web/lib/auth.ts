/*
 * FILE    : apps/web/lib/auth.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Resolve who is calling. Web requests use the Supabase session cookie;
 *           the mobile app sends `Authorization: Bearer <supabase access token>`.
 * UPDATED : 2026-10-07_0600 UTC — owners (OWNER_EMAILS) are admins on every request, not only when they come through
 *           /auth/callback — a session from before OWNER_EMAILS was set (or a code typed in the app) no longer lands in the
 *           customer account / "Staff only".
 * UPDATED : 2026-10-11_0451 UTC — isAdmin() + ADMINS_ONLY: dispatchers run day-to-day operations; money, settings, marketing
 *           email and pro approvals/standing are admin-only (enforced in each /api/hub route, menu hidden in the Hub).
 * UPDATED : 2026-10-27_2300 UTC — office managers: someone the pro owner invited (contractor_members) signs in with their own
 *           email and acts for the company (contractorId = the company, proRole "office"). Their first sign-in claims the
 *           invite. ownerOnly() keeps money, tax, contracts, documents, prices and the team with the owner.
 */
import "server-only";
import type { Role } from "@handled/core";
import { serverClient, tokenClient } from "./supabase/server";
import { supabaseConfigured } from "./supabase/env";

export interface Viewer {
  userId: string;
  email: string;
  role: Role;
  fullName: string | null;
  contractorId: string | null;
  /** owner = the pro's own login; office = an office manager the owner invited (lib/pro-team.ts). */
  proRole: "owner" | "office" | null;
  db: Awaited<ReturnType<typeof serverClient>> | ReturnType<typeof tokenClient>;
}

export async function getViewer(req?: Request): Promise<Viewer | null> {
  if (!supabaseConfigured) return null;
  const bearer = req?.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  const db = bearer ? tokenClient(bearer) : await serverClient();
  const { data } = bearer ? await db.auth.getUser(bearer) : await db.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const [{ data: profile }, { data: contractor }] = await Promise.all([
    db.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle(),
    db.from("contractors").select("id").eq("profile_id", user.id).maybeSingle(),
  ]);
  let role = (profile?.role as Role) ?? "customer";
  if (role !== "admin" && isOwnerEmail(user.email)) {
    role = "admin";
    const { adminClient } = await import("./supabase/server");
    await adminClient().from("profiles").update({ role: "admin" }).eq("id", user.id).then(() => null, () => null);
  }
  const office = contractor ? null : await officeCompany(user.id, user.email);
  return {
    userId: user.id,
    email: user.email ?? "",
    role,
    fullName: profile?.full_name ?? null,
    contractorId: contractor?.id ?? office ?? null,
    proRole: contractor ? "owner" : office ? "office" : null,
    db,
  };
}

/** The pro company this person runs the office for: an active invite already claimed, or claimed now by email. */
async function officeCompany(userId: string, email?: string | null): Promise<string | null> {
  const { adminClient } = await import("./supabase/server");
  const addr = (email ?? "").trim().toLowerCase();
  const q = adminClient().from("contractor_members").select("id, contractor_id, profile_id").eq("active", true);
  const { data, error } = await (addr && !/[,()]/.test(addr) ? q.or(`profile_id.eq.${userId},and(profile_id.is.null,email.eq.${addr})`) : q.eq("profile_id", userId)).limit(1).maybeSingle();
  if (error || !data) return null; // includes "table not added yet"
  const now = new Date().toISOString();
  await adminClient().from("contractor_members").update(data.profile_id ? { last_seen_at: now } : { profile_id: userId, accepted_at: now, last_seen_at: now }).eq("id", data.id).then(() => null, () => null);
  return data.contractor_id as string;
}

export const OFFICE_NOT_ALLOWED = "Only the company owner can do this (money, tax, contracts, documents, prices and your office team)";
/** Office managers run jobs and the crew; the owner keeps everything else. Returns the refusal, or null. */
export const ownerOnly = (v: Viewer | null) => (v?.proRole === "office" ? deny(403, OFFICE_NOT_ALLOWED) : null);

/** Emails listed in OWNER_EMAILS (Vercel) are admins from their first sign-in. */
export const ownerEmails = () => (process.env.OWNER_EMAILS ?? "").split(/[,\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
export const isOwnerEmail = (email?: string | null) => Boolean(email) && ownerEmails().includes(email!.trim().toLowerCase());

export const isStaff = (v: Viewer | null) => v?.role === "admin" || v?.role === "dispatcher";
export const isAdmin = (v: Viewer | null) => v?.role === "admin";
/** The refusal a dispatcher sees for money, settings, marketing email and pro approval/standing actions. */
export const ADMINS_ONLY = "Admins only — ask an admin (Hub → Team) to do this";

export function deny(status = 403, message = "Not allowed") {
  return Response.json({ error: message }, { status });
}
