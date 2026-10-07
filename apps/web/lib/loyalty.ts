/*
 * FILE    : apps/web/lib/loyalty.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-07_0530 UTC
 * PURPOSE : Handled Points engine — every customer account keeps a points balance (rules: packages/core/src/loyalty.ts).
 *             earnForJob      — a job is completed: pending points (and the first-job bonus) for the account that booked it
 *                               (the business account when the job is on one, otherwise the person: login + email)
 *             releaseLoyalty  — daily: pending points past the make-it-right window become available (refunds and
 *                               cancellations void them), +review bonus, inactivity expiry
 *             loyaltyFor      — balance, tier, history and unused credit codes (account pages, app, Hub)
 *             redeemPoints    — blocks of points → a credit code (applied at checkout like a gift card)
 *             adjustLoyalty / loyaltySummary — staff (Hub)
 */
import "server-only";
import {
  BRAND, checkRedeem, loyaltyBalance, loyaltyDollars, loyaltyPointsForJob, loyaltyTier, makeCode, mergeLoyalty, money, paidForPoints,
  type Job, type LoyaltyEntry, type LoyaltySettings,
} from "@handled/core";
import { adminClient } from "./supabase/server";
import { notify } from "./push";
import { siteUrl } from "./notify";

const db = () => adminClient();

/** Whose points: a business account, or a person (login and/or email). */
export type LoyaltyAccount = { businessId?: string | null; profileId?: string | null; email?: string | null };

export type LedgerRow = LoyaltyEntry & { id: string; profile_id: string | null; email: string | null; business_account_id: string | null; job_id: string | null; code: string | null; note: string | null; available_at: string | null; detail: Record<string, unknown> | null };

export const accountOfJob = (j: Pick<Job, "customer_id" | "contact_email"> & { business_account_id?: string | null }): LoyaltyAccount =>
  j.business_account_id ? { businessId: j.business_account_id } : { profileId: j.customer_id, email: j.contact_email?.trim().toLowerCase() || null };

const keyOf = (a: LoyaltyAccount) => a.businessId ? `b:${a.businessId}` : a.profileId ? `p:${a.profileId}` : `e:${a.email ?? ""}`;
const rowOwner = (a: LoyaltyAccount) => a.businessId
  ? { business_account_id: a.businessId, profile_id: null, email: null }
  : { business_account_id: null, profile_id: a.profileId ?? null, email: a.email?.trim().toLowerCase() ?? null };

export async function getLoyaltySettings(): Promise<LoyaltySettings> {
  const { data } = await db().from("loyalty_settings").select("settings").eq("id", 1).maybeSingle();
  return mergeLoyalty((data?.settings ?? {}) as Partial<LoyaltySettings>);
}

export async function saveLoyaltySettings(s: Partial<LoyaltySettings>, who: string) {
  const merged = mergeLoyalty({ ...(await getLoyaltySettings()), ...s });
  await db().from("loyalty_settings").upsert({ id: 1, settings: merged, updated_by: who, updated_at: new Date().toISOString() });
  return merged;
}

/** Every ledger row for one account (a person's rows match their login or their email). */
export async function ledgerOf(a: LoyaltyAccount): Promise<LedgerRow[]> {
  const cols = "id, profile_id, email, business_account_id, kind, points, status, job_id, code, note, available_at, detail, created_at";
  if (a.businessId) {
    const { data } = await db().from("loyalty_ledger").select(cols).eq("business_account_id", a.businessId).order("created_at", { ascending: false }).limit(5000);
    return (data ?? []) as LedgerRow[];
  }
  const email = a.email?.trim().toLowerCase();
  // two simple queries (no filter strings built from user-supplied emails)
  const [byLogin, byEmail] = await Promise.all([
    a.profileId ? db().from("loyalty_ledger").select(cols).is("business_account_id", null).eq("profile_id", a.profileId).limit(5000) : Promise.resolve({ data: [] }),
    email ? db().from("loyalty_ledger").select(cols).is("business_account_id", null).ilike("email", email).limit(5000) : Promise.resolve({ data: [] }),
  ]);
  const seen = new Set<string>();
  return ([...(byLogin.data ?? []), ...(byEmail.data ?? [])] as LedgerRow[])
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    .sort((x, y) => y.created_at.localeCompare(x.created_at));
}

/** Called when a job is completed: pending points, final at release. */
export async function earnForJob(job: Job) {
  const s = await getLoyaltySettings();
  if (!s.enabled || job.status === "cancelled") return null;
  const a = accountOfJob(job);
  if (!a.businessId && !a.profileId && !a.email) return null;
  const paid = paidForPoints(job);
  if (paid <= 0) return null;
  const rows = await ledgerOf(a);
  const bal = loyaltyBalance(rows);
  const est = loyaltyPointsForJob(paid, bal.earned12m, s);
  if (est.points <= 0) return null;
  const available_at = new Date(Date.now() + s.pendingDays * 86400000).toISOString();
  const { error } = await db().from("loyalty_ledger").insert({
    ...rowOwner(a), kind: "earn", points: est.points, status: "pending", job_id: job.id, ref: `earn:${job.id}`, available_at,
    detail: { paid, ...est, estimate: true }, note: job.ref,
  });
  if (error) return null; // already credited (ref is unique)
  if (s.firstJobBonus > 0 && !rows.some((r) => r.kind === "earn"))
    await db().from("loyalty_ledger").insert({ ...rowOwner(a), kind: "bonus", points: s.firstJobBonus, status: "pending", job_id: job.id, ref: `first:${keyOf(a)}`, available_at, note: "First job bonus" });
  return est.points;
}

/** Daily: release pending points, add review bonuses, expire inactive balances. */
export async function releaseLoyalty() {
  const s = await getLoyaltySettings();
  const out = { released: 0, voided: 0, deferred: 0, reviewBonuses: 0, expired: 0 };
  if (!s.enabled) return out;
  const { data: due } = await db().from("loyalty_ledger").select("*").eq("status", "pending").lte("available_at", new Date().toISOString()).limit(1000);
  const ready: { profileId: string | null; points: number }[] = [];
  for (const e of (due ?? []) as (LedgerRow & { ref: string | null })[]) {
    const { data: job } = e.job_id ? await db().from("jobs").select("*").eq("id", e.job_id).maybeSingle() : { data: null };
    const j = job as Job | null;
    if (!j || j.status === "cancelled") { await db().from("loyalty_ledger").update({ status: "void", note: `${e.note ?? ""} · job cancelled or removed` }).eq("id", e.id); out.voided++; continue; }
    // not paid yet (and not on business terms): wait another week
    if (!j.paid_at && !j.billed_on_terms) { await db().from("loyalty_ledger").update({ available_at: new Date(Date.now() + 7 * 86400000).toISOString() }).eq("id", e.id); out.deferred++; continue; }
    const paid = paidForPoints(j);
    if (paid <= 0) { await db().from("loyalty_ledger").update({ status: "void", points: 0, note: `${e.note ?? ""} · refunded` }).eq("id", e.id); out.voided++; continue; }
    let points = e.points;
    if (e.kind === "earn") {
      // final points on what was actually kept (partial refunds lower it); the tier at the time of the job stays
      const mult = Number((e.detail as { multiplier?: number } | null)?.multiplier ?? 1);
      points = Math.floor(Math.floor(paid * s.earnRate) * mult);
    }
    await db().from("loyalty_ledger").update({ status: "available", points, detail: { ...(e.detail ?? {}), paid, estimate: false } }).eq("id", e.id);
    out.released++;
    ready.push({ profileId: e.profile_id ?? j.customer_id, points });
    // rated the pro → review bonus (once per job)
    if (e.kind === "earn" && s.reviewBonus > 0) {
      const { data: review } = await db().from("reviews").select("id").eq("job_id", j.id).maybeSingle();
      if (review) {
        const { error } = await db().from("loyalty_ledger").insert({ profile_id: e.profile_id, email: e.email, business_account_id: e.business_account_id, kind: "bonus", points: s.reviewBonus, status: "available", job_id: j.id, ref: `review:${j.id}`, note: "Thanks for rating your pro" });
        if (!error) out.reviewBonuses++;
      }
    }
  }
  for (const r of ready) if (r.profileId && r.points > 0) await notify(r.profileId, {
    title: `+${r.points.toLocaleString("en-US")} ${BRAND.name} Points`, body: "Your points are ready to use. See your balance in your account.", data: { type: "account" }, channel: "updates",
    es: { title: `+${r.points.toLocaleString("en-US")} puntos ${BRAND.name}`, body: "Sus puntos están listos para usar. Vea su saldo en su cuenta." },
  }).catch(() => {});
  out.expired = await expireInactive(s);
  return out;
}

async function expireInactive(s: LoyaltySettings) {
  const cutoff = new Date(Date.now() - s.inactivityExpiryMonths * 30.44 * 86400000).toISOString();
  const { data } = await db().from("loyalty_ledger").select("profile_id, email, business_account_id, kind, points, status, created_at").neq("status", "void").limit(50000);
  const byAcct = new Map<string, { a: LoyaltyAccount; rows: LoyaltyEntry[] }>();
  for (const r of (data ?? []) as LedgerRow[]) {
    const a: LoyaltyAccount = r.business_account_id ? { businessId: r.business_account_id } : { profileId: r.profile_id, email: r.email };
    const k = keyOf(a);
    const g = byAcct.get(k) ?? { a, rows: [] };
    g.rows.push(r);
    byAcct.set(k, g);
  }
  let n = 0;
  for (const { a, rows } of byAcct.values()) {
    const { available } = loyaltyBalance(rows);
    if (available <= 0 || rows.some((r) => (r.kind === "earn" || r.status === "pending") && r.created_at >= cutoff)) continue;
    await db().from("loyalty_ledger").insert({ ...rowOwner(a), kind: "expire", points: -available, status: "available", note: `No completed job in ${s.inactivityExpiryMonths} months` });
    n++;
  }
  return n;
}

/** Everything an account page needs. */
export async function loyaltyFor(a: LoyaltyAccount) {
  const [s, rows] = await Promise.all([getLoyaltySettings(), ledgerOf(a)]);
  const bal = loyaltyBalance(rows);
  const codes = rows.filter((r) => r.kind === "redeem" && r.code).map((r) => r.code!);
  const { data: credits } = codes.length ? await db().from("promo_codes").select("code, value, balance, created_at").in("code", codes).gt("balance", 0) : { data: [] };
  return {
    settings: s, ...bal, tier: loyaltyTier(bal.earned12m), worth: loyaltyDollars(bal.available, s),
    history: rows.filter((r) => r.status !== "void").slice(0, 25),
    credits: (credits ?? []) as { code: string; value: number; balance: number; created_at: string }[],
  };
}

/** Points → credit code (atomic in the database). */
export async function redeemPoints(a: LoyaltyAccount, points: number, who: { profileId: string; email: string }) {
  const s = await getLoyaltySettings();
  const bal = loyaltyBalance(await ledgerOf(a));
  const check = checkRedeem(points, bal.available, s);
  if (!check.ok) return { ok: false as const, error: check.message };
  const code = makeCode("PTS", 8);
  const { data, error } = await db().rpc("redeem_loyalty", {
    p_profile: a.businessId ? who.profileId : a.profileId ?? who.profileId, p_email: a.businessId ? who.email : a.email ?? who.email,
    p_business: a.businessId ?? null, p_points: points, p_code: code, p_value: check.credit, p_who: who.email,
  });
  if (error) return { ok: false as const, error: "Couldn't redeem right now. Please try again." };
  if (!data) return { ok: false as const, error: "Not enough points available." };
  await notify(who.profileId, {
    title: `${money(check.credit)} credit ready`, body: `Code ${code} — use it at checkout.`, data: { type: "account" },
    email: { to: who.email, subject: `Your ${money(check.credit)} ${BRAND.name} Points credit`, text: `You turned ${points.toLocaleString("en-US")} points into a ${money(check.credit)} credit.\n\nCredit code: ${code}\nUse it at checkout: ${siteUrl()}/book\n\n— ${BRAND.name}` },
    es: { title: `Crédito de ${money(check.credit)} listo`, body: `Código ${code}: úselo al pagar.`, subject: `Su crédito de ${money(check.credit)} de puntos ${BRAND.name}`,
      text: `Convirtió ${points.toLocaleString("en-US")} puntos en un crédito de ${money(check.credit)}.\n\nCódigo de crédito: ${code}\nÚselo al pagar: ${siteUrl()}/book\n\n— ${BRAND.name}` },
  }).catch(() => {});
  return { ok: true as const, code, credit: check.credit };
}

/** Staff: add or take away points (goodwill, corrections). */
export async function adjustLoyalty(a: LoyaltyAccount, points: number, note: string, who: string) {
  if (!points || !note.trim()) return { ok: false, error: "Points and a reason are required" };
  if (points < 0 && loyaltyBalance(await ledgerOf(a)).available + points < 0) return { ok: false, error: "That would make the balance negative" };
  const { error } = await db().from("loyalty_ledger").insert({ ...rowOwner(a), kind: "adjust", points, status: "available", note: note.trim(), created_by: who });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Hub: every account's balance, and what the points are worth (liability). */
export async function loyaltySummary() {
  const s = await getLoyaltySettings();
  const { data } = await db().from("loyalty_ledger").select("profile_id, email, business_account_id, kind, points, status, created_at").neq("status", "void").limit(50000);
  const rows = (data ?? []) as LedgerRow[];
  const groups = new Map<string, { key: string; a: LoyaltyAccount; rows: LoyaltyEntry[] }>();
  for (const r of rows) {
    const a: LoyaltyAccount = r.business_account_id ? { businessId: r.business_account_id } : { profileId: r.profile_id, email: r.email };
    const k = keyOf(a);
    const g = groups.get(k) ?? { key: k, a, rows: [] };
    if (!g.a.email && r.email) g.a.email = r.email;
    g.rows.push(r);
    groups.set(k, g);
  }
  const bizIds = [...groups.values()].map((g) => g.a.businessId).filter(Boolean) as string[];
  const { data: biz } = bizIds.length ? await db().from("business_accounts").select("id, company").in("id", bizIds) : { data: [] };
  const company = new Map(((biz ?? []) as { id: string; company: string }[]).map((b) => [b.id, b.company]));
  const accounts = [...groups.values()].map((g) => {
    const b = loyaltyBalance(g.rows);
    return { key: g.key, ...g.a, name: g.a.businessId ? company.get(g.a.businessId) ?? "Business account" : g.a.email ?? "Customer", ...b, tier: loyaltyTier(b.earned12m).key };
  }).sort((x, y) => y.available + y.pending - (x.available + x.pending));
  const available = accounts.reduce((t, a) => t + a.available, 0);
  const pending = accounts.reduce((t, a) => t + a.pending, 0);
  const redeemed = accounts.reduce((t, a) => t + a.redeemed, 0);
  return { settings: s, accounts, available, pending, redeemed, liability: loyaltyDollars(available + pending, s), redeemedDollars: loyaltyDollars(redeemed, s) };
}
