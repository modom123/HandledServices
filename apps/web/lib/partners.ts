/*
 * FILE    : apps/web/lib/partners.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0105 UTC
 * PURPOSE : Referral Partner Program (rules in packages/core/src/partners.ts).
 *             signUp()            — anyone becomes a partner: code, link, welcome email with a sign-in link
 *             referCustomer()     — a partner sends us a customer: we email them a booking link, the customer is theirs
 *             attributeJob()      — at booking: credit the job to the customer's partner (existing referral, or a
 *                                   partner link clicked in the last 90 days for a NEW customer)
 *             accrueCommission()  — at completion: 10% of our take, payable after the 30-day window
 *             runPartnerPayouts() — Mondays: every eligible commission, re-checked for refunds, sent via Stripe Connect
 *           Guards: one partner per customer (first wins), no self-referrals, existing customers don't count,
 *           suspended partners earn nothing, refunds reduce or void the commission before it's paid.
 * UPDATED : 2026-10-07_1610 UTC — partner payouts: only the transfer decides success (no double pay after a later error); checks the Stripe balance first; per-attempt idempotency keys.
 */
import "server-only";
import { cookies } from "next/headers";
import {
  BRAND, PARTNER_PROGRAM, cleanPartnerCode, getService, makePartnerCode, money, partnerCommission, partnerExpiry, partnerTake,
  type Job, type PartnerKind,
} from "@handled/core";
import { adminClient } from "./supabase/server";
import { opsEmail, sendEmail, siteUrl } from "./notify";
import { raiseAlert } from "./jobs";
import { availableBalance, getStripe } from "./stripe";

const db = () => adminClient();
export const PARTNER_COOKIE = "handled_partner";
const lower = (e: string) => e.trim().toLowerCase();

export type Partner = {
  id: string; code: string; name: string; email: string; phone: string | null; company: string | null; kind: PartnerKind; how: string | null;
  status: "active" | "suspended"; profile_id: string | null; stripe_account_id: string | null; xero_contact_id: string | null; created_at: string;
};

export const partnerLink = (code: string, path = "/home") => `${siteUrl()}${path}?partner=${code}`;

// ─── Sign-up ─────────────────────────────────────────────────────────────────

export async function signUp(o: { name: string; email: string; phone?: string | null; company?: string | null; kind: PartnerKind; how?: string | null; ip: string | null }): Promise<{ partner: Partner; existing: boolean }> {
  const email = lower(o.email);
  const { data: found } = await db().from("referral_partners").select("*").eq("email", email).maybeSingle();
  if (found) { await sendWelcome(found as Partner, true); return { partner: found as Partner, existing: true }; }
  let partner: Partner | null = null;
  for (let i = 0; i < 5 && !partner; i++) {
    const { data, error } = await db().from("referral_partners").insert({
      code: makePartnerCode(o.company || o.name), name: o.name.trim(), email, phone: o.phone || null, company: o.company || null, kind: o.kind, how: o.how || null,
      terms_version: PARTNER_PROGRAM.termsVersion, terms_accepted_at: new Date().toISOString(), terms_ip: o.ip,
    }).select("*").single();
    if (data) partner = data as Partner;
    else if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
  }
  if (!partner) throw new Error("Couldn't create a partner code — try again");
  await sendWelcome(partner, false);
  if (opsEmail()) await sendEmail(opsEmail(), `New referral partner: ${partner.name}${partner.company ? ` (${partner.company})` : ""}`, `${partner.kind} · ${email} · code ${partner.code}\n${partner.how ?? ""}\n\nHub → Partners: ${siteUrl()}/hub/partners`).catch(() => {});
  return { partner, existing: false };
}

/** The partner's code, link and a one-tap sign-in to their partner page (sent at sign-up, and again if they sign up twice). */
async function sendWelcome(partner: Partner, again: boolean) {
  const { signInLink } = await import("./signin");
  const portal = await signInLink(partner.email, "/partner");
  await sendEmail(partner.email, again ? `Your ${BRAND.name} partner link` : `Welcome to the ${BRAND.name} Partner Program`, `Hi ${partner.name.split(" ")[0]},\n\n${again ? "Here's your partner info again." : "You're in."} Your partner code is ${partner.code}.\n\nShare this link: ${partnerLink(partner.code)}\nShort link for cards and texts: ${siteUrl()}/r/${partner.code}\n\nYou earn ${PARTNER_PROGRAM.pctOfTake * 100}% of ${BRAND.name}'s fee on every job from customers you refer, for ${PARTNER_PROGRAM.months} months, paid weekly once each job is past our ${PARTNER_PROGRAM.holdDays}-day make-it-right window.\n\nYour partner page (send customers directly, track earnings, set up payouts): ${portal}\n\n— ${BRAND.name}`);
}

/** The signed-in person's partner record (by account, else by email — and link the account on first visit). */
export async function partnerFor(viewer: { userId: string; email: string }): Promise<Partner | null> {
  const { data: byProfile } = await db().from("referral_partners").select("*").eq("profile_id", viewer.userId).maybeSingle();
  if (byProfile) return byProfile as Partner;
  const { data: byEmail } = await db().from("referral_partners").select("*").eq("email", lower(viewer.email)).maybeSingle();
  if (byEmail && !byEmail.profile_id) await db().from("referral_partners").update({ profile_id: viewer.userId }).eq("id", byEmail.id);
  return (byEmail as Partner) ?? null;
}

// ─── Who a customer belongs to ───────────────────────────────────────────────

/** Has this email already paid for a job with us (other than `exceptJob`)? Existing customers can't be referred. */
async function isExistingCustomer(email: string, exceptJob?: string) {
  let q = db().from("jobs").select("id", { count: "exact", head: true }).ilike("contact_email", email).not("paid_at", "is", null);
  if (exceptJob) q = q.neq("id", exceptJob);
  const { count } = await q;
  return (count ?? 0) > 0;
}

/** A partner sends us a customer directly. They get an email with a booking link; the customer is the partner's. */
export async function referCustomer(partner: Partner, c: { name: string; email: string; phone?: string | null; service_slug?: string | null; note?: string | null }): Promise<{ ok: true } | { ok: false; error: string }> {
  if (partner.status !== "active") return { ok: false, error: "Your partner account is paused — contact us." };
  const email = lower(c.email);
  if (email === partner.email) return { ok: false, error: "You can't refer yourself." };
  const { data: taken } = await db().from("referral_customers").select("partner_id").eq("customer_email", email).maybeSingle();
  if (taken) return { ok: false, error: taken.partner_id === partner.id ? "You already referred this customer." : "This customer was already referred by someone else." };
  if (await isExistingCustomer(email)) return { ok: false, error: `This customer already uses ${BRAND.name}, so they can't be referred.` };
  const { error } = await db().from("referral_customers").insert({
    partner_id: partner.id, customer_email: email, customer_name: c.name, customer_phone: c.phone || null, service_slug: c.service_slug || null, note: c.note || null,
    source: "direct", expires_at: partnerExpiry(new Date()).toISOString(),
  });
  if (error) return { ok: false, error: /duplicate|unique/i.test(error.message) ? "This customer was already referred." : error.message };
  const svc = c.service_slug ? getService(c.service_slug) : null;
  const book = `${siteUrl()}/book?${svc ? `service=${svc.slug}&` : ""}partner=${partner.code}`;
  await sendEmail(email, `${partner.name} recommended ${BRAND.name}${svc ? ` for ${svc.name.toLowerCase()}` : ""}`,
    `Hi ${c.name.split(" ")[0]},\n\n${partner.name}${partner.company ? ` (${partner.company})` : ""} thought you'd like ${BRAND.name}${svc ? ` for your ${svc.name.toLowerCase()}` : ""}: insured, background-checked local pros, an upfront price in 60 seconds, photo proof when it's done, and a free redo if anything's missed.\n\nSee your price and book: ${book}\n${c.note ? `\nNote from ${partner.name.split(" ")[0]}: ${c.note}\n` : ""}\nQuestions? Just reply.\n\n— ${BRAND.name}`);
  return { ok: true };
}

/**
 * At booking: credit the job to a partner. An existing referral for this email (still inside its 12 months) wins;
 * otherwise a partner link clicked in this browser counts — only for a NEW customer, never the partner themselves.
 */
export async function attributeJob(job: Job): Promise<string | null> {
  const email = lower(job.contact_email);
  const { data: ref } = await db().from("referral_customers").select("id, partner_id, first_job_id, expires_at, referral_partners(status)").eq("customer_email", email).maybeSingle();
  let partnerId: string | null = null;
  if (ref) {
    const active = (ref.referral_partners as unknown as { status: string } | null)?.status === "active";
    if (active && new Date(ref.expires_at) > new Date()) partnerId = ref.partner_id;
    if (partnerId && !ref.first_job_id) await db().from("referral_customers").update({ first_job_id: job.id }).eq("id", ref.id);
  } else {
    let code: string | null = null;
    try { code = cleanPartnerCode((await cookies()).get(PARTNER_COOKIE)?.value); } catch { /* not in a request (cron, app) */ }
    if (!code) return null;
    const { data: p } = await db().from("referral_partners").select("id, email, status").eq("code", code).maybeSingle();
    if (!p || p.status !== "active" || p.email === email) return null;
    if (await isExistingCustomer(email, job.id)) return null;
    const { error } = await db().from("referral_customers").insert({ partner_id: p.id, customer_email: email, customer_name: job.contact_name, customer_phone: job.contact_phone, service_slug: job.service_slug, source: "link", first_job_id: job.id, expires_at: partnerExpiry(new Date()).toISOString() });
    if (error) return null; // someone else claimed this customer a moment ago
    partnerId = p.id;
  }
  if (partnerId) await db().from("jobs").update({ partner_id: partnerId }).eq("id", job.id);
  return partnerId;
}

// ─── Commissions ─────────────────────────────────────────────────────────────

/** At completion: record the partner's commission (paid after the make-it-right window). */
export async function accrueCommission(job: Job) {
  if (!job.partner_id || job.remedy || !(Number(job.price_final) > 0)) return;
  const { data: ref } = await db().from("referral_customers").select("expires_at").eq("customer_email", lower(job.contact_email)).eq("partner_id", job.partner_id).maybeSingle();
  if (!ref || new Date(job.created_at) > new Date(ref.expires_at)) return; // booked after the 12 months
  const o = { price: Number(job.price_final), payout: Number(job.contractor_payout ?? 0), refunded: Number(job.amount_refunded ?? 0) };
  const amount = partnerCommission(o);
  if (amount <= 0) return;
  const done = job.completed_at ? new Date(job.completed_at) : new Date();
  await db().from("partner_commissions").upsert({
    partner_id: job.partner_id, job_id: job.id, take: partnerTake(o), amount, status: "pending",
    eligible_at: new Date(done.getTime() + PARTNER_PROGRAM.holdDays * 86400000).toISOString(),
  }, { onConflict: "job_id", ignoreDuplicates: true });
}

const mondayOf = (d: Date) => { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); };

/** Mondays: pay every eligible commission (re-checked against refunds) to partners whose Stripe payouts are ready. */
export async function runPartnerPayouts(now = new Date()) {
  const s = getStripe();
  const week = mondayOf(now);
  const { data: due } = await db().from("partner_commissions").select("id, partner_id, job_id, amount, jobs(price_final, contractor_payout, amount_refunded, remedy, status)").eq("status", "pending").lte("eligible_at", now.toISOString()).limit(5000);
  type Row = { id: string; partner_id: string; job_id: string; amount: number; jobs: { price_final: number; contractor_payout: number; amount_refunded: number; remedy: string | null; status: string } | null };
  const byPartner = new Map<string, Row[]>();
  let voided = 0;
  for (const r of (due ?? []) as unknown as Row[]) {
    // refunds after completion come out of our take first → the commission follows it down (never up)
    const j = r.jobs;
    const now$ = j && j.status === "completed" && !j.remedy ? Math.min(Number(r.amount), partnerCommission({ price: Number(j.price_final), payout: Number(j.contractor_payout), refunded: Number(j.amount_refunded) })) : 0;
    if (now$ <= 0) { await db().from("partner_commissions").update({ status: "void", amount: 0, note: "job refunded or cancelled" }).eq("id", r.id); voided++; continue; }
    if (now$ !== Number(r.amount)) { await db().from("partner_commissions").update({ amount: now$, note: "reduced by a refund" }).eq("id", r.id); r.amount = now$; }
    byPartner.set(r.partner_id, [...(byPartner.get(r.partner_id) ?? []), r]);
  }
  let paid = 0, total = 0, waiting = 0;
  const failed: string[] = [];
  let funds = await availableBalance(); // card money takes ~2 days to become available in Stripe
  for (const [pid, rows] of byPartner) {
    const amount = Math.round(rows.reduce((t, r) => t + Number(r.amount), 0) * 100) / 100;
    if (amount < PARTNER_PROGRAM.minPayout) continue; // rolls to next week
    const { data: p } = await db().from("referral_partners").select("*").eq("id", pid).single();
    const partner = p as Partner;
    if (partner.status !== "active") continue;
    const ready = s && partner.stripe_account_id ? Boolean((await s.accounts.retrieve(partner.stripe_account_id).catch(() => null))?.payouts_enabled) : false;
    if (!s || !ready) {
      waiting++;
      await sendEmail(partner.email, `${money(amount)} in referral commissions is ready for you`, `Hi ${partner.name.split(" ")[0]},\n\nYou have ${money(amount)} in ${BRAND.name} referral commissions ready to send. Set up payouts (2 minutes, through Stripe) on your partner page: ${siteUrl()}/partner\n\n— ${BRAND.name}`).catch(() => {});
      continue;
    }
    if (funds !== null && funds < amount) { failed.push(`${partner.name}: not enough available in Stripe yet — waits for next week`); continue; }
    const ids = rows.map((r) => r.id);
    const stamp = new Date().toISOString();
    const { data: claimed } = await db().from("partner_commissions").update({ status: "paid", paid_at: stamp, week_of: week }).in("id", ids).eq("status", "pending").select("id");
    if ((claimed ?? []).length !== ids.length) {
      if (claimed?.length) await db().from("partner_commissions").update({ status: "pending", paid_at: null, week_of: null }).in("id", claimed.map((x: { id: string }) => x.id));
      failed.push(`${partner.name} (changed while paying)`);
      continue;
    }
    let t: { id: string };
    try {
      t = await s.transfers.create({ amount: Math.round(amount * 100), currency: "usd", destination: partner.stripe_account_id!, description: `${BRAND.name} referral commissions — week of ${week}`, metadata: { partner_id: pid, kind: "partner_commission", week_of: week } }, { idempotencyKey: `partner-${pid}-${week}-${stamp}` });
    } catch (e) {
      await db().from("partner_commissions").update({ status: "pending", paid_at: null, week_of: null }).in("id", ids);
      failed.push(`${partner.name}: ${e instanceof Error ? e.message : "transfer failed"}`);
      continue;
    }
    // money has moved: problems after this are reported, never undone (undoing would pay twice next week)
    paid++; total = Math.round((total + amount) * 100) / 100;
    if (funds !== null) funds = Math.round((funds - amount) * 100) / 100;
    try {
      await db().from("partner_commissions").update({ stripe_transfer_id: t.id }).in("id", ids);
      await sendEmail(partner.email, `Paid: ${money(amount)} in ${BRAND.name} referral commissions`, `Hi ${partner.name.split(" ")[0]},\n\nWe sent ${money(amount)} for ${rows.length} completed job${rows.length === 1 ? "" : "s"} from customers you referred. It reaches your bank on Stripe's normal schedule (usually 2 business days).\n\nEvery job and payment: ${siteUrl()}/partner\n\nThank you for sending people our way.\n\n— ${BRAND.name}`).catch(() => {});
    } catch (e) {
      await raiseAlert("partners", "warn", `Partner payout sent but not fully recorded — ${partner.name}`, `Transfer ${t.id}: ${e instanceof Error ? e.message : String(e)}`).catch(() => {});
    }
  }
  if (failed.length) await raiseAlert("partners", "critical", `Partner payouts: ${failed.length} failed`, failed.join("\n"));
  if (paid || waiting) await raiseAlert("partners", "info", `Partner payouts sent: ${paid} partner(s), ${money(total)}`, waiting ? `${waiting} partner(s) still need to set up Stripe payouts — reminded.` : null);
  return { paid, total, waiting, voided, failed: failed.length };
}

/** Stripe Connect (Express) onboarding so a partner can be paid. Tax details for 1099s are collected by Stripe. */
export async function partnerConnectUrl(partner: Partner): Promise<string | null> {
  const s = getStripe();
  if (!s) return null;
  let acct = partner.stripe_account_id;
  if (!acct) {
    acct = (await s.accounts.create({
      type: "express", email: partner.email, business_profile: { name: partner.company || partner.name },
      capabilities: { transfers: { requested: true } }, metadata: { partner_id: partner.id },
    })).id;
    await db().from("referral_partners").update({ stripe_account_id: acct }).eq("id", partner.id);
  }
  const link = await s.accountLinks.create({ account: acct, type: "account_onboarding", refresh_url: `${siteUrl()}/partner?connect=retry`, return_url: `${siteUrl()}/partner?connect=done` });
  return link.url;
}

export async function payoutsReady(partner: Partner) {
  const s = getStripe();
  if (!s || !partner.stripe_account_id) return false;
  return Boolean((await s.accounts.retrieve(partner.stripe_account_id).catch(() => null))?.payouts_enabled);
}

/** Totals for the partner page and the Hub. */
export async function partnerStats(partnerId: string) {
  const [{ count: customers }, { data: comms }] = await Promise.all([
    db().from("referral_customers").select("id", { count: "exact", head: true }).eq("partner_id", partnerId),
    db().from("partner_commissions").select("amount, status, eligible_at").eq("partner_id", partnerId),
  ]);
  const now = Date.now();
  const sum = (f: (r: { amount: number; status: string; eligible_at: string }) => boolean) => Math.round(((comms ?? []) as { amount: number; status: string; eligible_at: string }[]).filter(f).reduce((t, r) => t + Number(r.amount), 0) * 100) / 100;
  return {
    customers: customers ?? 0,
    paid: sum((r) => r.status === "paid"),
    ready: sum((r) => r.status === "pending" && new Date(r.eligible_at).getTime() <= now),
    upcoming: sum((r) => r.status === "pending" && new Date(r.eligible_at).getTime() > now),
    jobs: (comms ?? []).filter((r: { status: string }) => r.status !== "void").length,
  };
}
