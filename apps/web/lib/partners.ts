/*
 * FILE    : apps/web/lib/partners.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0105 UTC
 * PURPOSE : Referral Partner Program (rules in packages/core/src/partners.ts).
 *             signUp()            — anyone becomes a partner: code, link, welcome email with a sign-in link
 *             submitTicket()      — a partner fills out the standard referral ticket: ticket number, we email the
 *                                   customer a booking link, the customer is theirs; ops and the partner get a copy
 *             attributeJob()      — at booking: credit the job to the customer's partner (existing referral, or a
 *                                   partner link clicked in the last 90 days for a NEW customer) and set its tier
 *             partnerSplitForJob()— at completion: the partner's 25% / 10% / 15% of the price, half off the pro's payout
 *             accrueCommission()  — at completion: record it, payable after the 30-day window
 *             runPartnerPayouts() — Mondays: every eligible commission, re-checked for refunds (the pro's half handed
 *                                   back to match), sent via Stripe Connect
 *             voidCommission()    — Hub: cancel an unpaid commission (the pro's half handed back)
 *           Guards: one partner per customer (first wins), no self-referrals, existing customers don't count,
 *           suspended partners earn nothing, refunds reduce or void the commission before it's paid.
 * UPDATED : 2026-10-07_1610 UTC — partner payouts: only the transfer decides success (no double pay after a later error); checks the Stripe balance first; per-attempt idempotency keys.
 * UPDATED : 2026-10-28_0122 UTC — partner-v2: fixed tiers of the job price split 50/50 pro / Handled; the standard referral ticket.
 */
import "server-only";
import { cookies } from "next/headers";
import {
  AGREEMENT_VERSION, BRAND, PARTNER_PROGRAM, TICKET_CONTACT, TICKET_JOB_TYPES, TICKET_RELATIONSHIPS, TICKET_TIMING,
  cleanPartnerCode, getService, makePartnerCode, makeTicketNo, money, partnerCommission, partnerExpiry, partnerLegacyJob, partnerRateLines,
  partnerSplit, partnerTake, partnerTier,
  type Job, type PartnerKind, type PartnerTier, type TicketContact, type TicketJobType, type TicketRelationship, type TicketStatus, type TicketTiming,
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
  await sendEmail(partner.email, again ? `Your ${BRAND.name} partner link` : `Welcome to the ${BRAND.name} Partner Program`, `Hi ${partner.name.split(" ")[0]},\n\n${again ? "Here's your partner info again." : "You're in."} Your partner code is ${partner.code}.\n\nShare this link: ${partnerLink(partner.code)}\nShort link for cards and texts: ${siteUrl()}/r/${partner.code}\n\nWhat you earn on every completed job from customers you refer (a share of the job price, the same on every service):\n${partnerRateLines().map((l) => `• ${l}`).join("\n")}\nPaid weekly once each job is past our ${PARTNER_PROGRAM.holdDays}-day make-it-right window.\n\nYour partner page (fill out a referral ticket, track every ticket and payment, set up payouts): ${portal}\n\n— ${BRAND.name}`);
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

export type Ticket = {
  name: string; email: string; phone?: string | null; company?: string | null; contact_pref: TicketContact; best_time?: string | null;
  address?: string | null; city?: string | null; zip: string; service_slug?: string | null; job_type: TicketJobType; timing: TicketTiming;
  preferred_date?: string | null; details?: string | null; relationship: TicketRelationship; note?: string | null; consent: true;
};

/**
 * The standard referral ticket: a partner sends us a customer (who agreed to be contacted). We give it a ticket number,
 * email the customer a booking link from the partner, and send ops and the partner a copy. The customer is the partner's.
 */
export async function submitTicket(partner: Partner, t: Ticket): Promise<{ ok: true; ticket_no: string } | { ok: false; error: string }> {
  if (partner.status !== "active") return { ok: false, error: "Your partner account is paused — contact us." };
  const email = lower(t.email);
  if (email === partner.email) return { ok: false, error: "You can't refer yourself." };
  const { data: taken } = await db().from("referral_customers").select("partner_id, ticket_no").eq("customer_email", email).maybeSingle();
  if (taken) return { ok: false, error: taken.partner_id === partner.id ? `You already referred this customer${taken.ticket_no ? ` (ticket ${taken.ticket_no})` : ""}.` : "This customer was already referred by someone else." };
  if (await isExistingCustomer(email)) return { ok: false, error: `This customer already uses ${BRAND.name}, so they can't be referred.` };
  const row = {
    partner_id: partner.id, customer_email: email, customer_name: t.name, customer_phone: t.phone || null, company: t.company || null,
    service_slug: t.service_slug || null, note: t.note || null, source: "direct", expires_at: partnerExpiry(new Date()).toISOString(),
    job_type: t.job_type, address: t.address || null, city: t.city || null, zip: t.zip, contact_pref: t.contact_pref, best_time: t.best_time || null,
    timing: t.timing, preferred_date: t.timing === "date" ? t.preferred_date || null : null, details: t.details || null, relationship: t.relationship,
    consent_at: new Date().toISOString(), status: "submitted",
  };
  let ticketNo: string | null = null;
  for (let i = 0; i < 5 && !ticketNo; i++) {
    const no = makeTicketNo();
    const { error } = await db().from("referral_customers").insert({ ...row, ticket_no: no });
    if (!error) ticketNo = no;
    else if (/customer_email/i.test(error.message)) return { ok: false, error: "This customer was already referred." };
    else if (!/duplicate|unique/i.test(error.message)) return { ok: false, error: /column/i.test(error.message) ? "Referral tickets aren't switched on yet — tell us and we'll fix it today." : error.message };
  }
  if (!ticketNo) return { ok: false, error: "Couldn't create a ticket number — try again" };
  const svc = t.service_slug ? getService(t.service_slug) : null;
  const book = `${siteUrl()}/book?${svc ? `service=${svc.slug}&` : ""}partner=${partner.code}`;
  await sendEmail(email, `${partner.name} recommended ${BRAND.name}${svc ? ` for ${svc.name.toLowerCase()}` : ""}`,
    `Hi ${t.name.split(" ")[0]},\n\n${partner.name}${partner.company ? ` (${partner.company})` : ""} thought you'd like ${BRAND.name}${svc ? ` for your ${svc.name.toLowerCase()}` : ""}: insured, background-checked local pros, an upfront price in 60 seconds, photo proof when it's done, and a free redo if anything's missed.\n\nSee your price and book: ${book}\n${t.note ? `\nNote from ${partner.name.split(" ")[0]}: ${t.note}\n` : ""}\nWe'll also reach out by ${TICKET_CONTACT[t.contact_pref].toLowerCase()}${t.best_time ? ` (${t.best_time})` : ""}. Questions? Just reply.\n\n— ${BRAND.name}`).catch(() => {});
  const summary = ticketText({ ...row, ticket_no: ticketNo });
  await sendEmail(partner.email, `Referral ticket ${ticketNo} received — ${t.name}`, `Hi ${partner.name.split(" ")[0]},\n\nThanks — we've got it. We emailed ${t.name.split(" ")[0]} a booking link from you and we'll reach out ourselves too.\n\n${summary}\n\nWhat you'll earn: ${TICKET_JOB_TYPES[t.job_type].earns}.\n\nFollow this ticket: ${siteUrl()}/partner\n\n— ${BRAND.name}`).catch(() => {});
  if (opsEmail()) await sendEmail(opsEmail(), `Referral ticket ${ticketNo}: ${t.name}${svc ? ` — ${svc.name}` : ""} (${partner.name})`, `${summary}\n\nPartner: ${partner.name}${partner.company ? ` (${partner.company})` : ""} · ${partner.email} · code ${partner.code}\n\nReach out by ${TICKET_CONTACT[t.contact_pref].toLowerCase()}, then mark it "We reached out" in Hub → Partners: ${siteUrl()}/hub/partners`).catch(() => {});
  return { ok: true, ticket_no: ticketNo };
}

/** A ticket as plain text (emails). Same order as the form. */
export function ticketText(r: { ticket_no: string | null; customer_name: string | null; customer_email: string; customer_phone?: string | null; company?: string | null; contact_pref?: string | null; best_time?: string | null; address?: string | null; city?: string | null; zip?: string | null; service_slug?: string | null; job_type?: string | null; timing?: string | null; preferred_date?: string | null; details?: string | null; relationship?: string | null; note?: string | null }) {
  const svc = r.service_slug ? getService(r.service_slug) : null;
  const where = [r.address, r.city, r.zip].filter(Boolean).join(", ");
  return [
    `REFERRAL TICKET ${r.ticket_no ?? ""}`.trim(),
    `Customer: ${r.customer_name ?? ""}${r.company ? ` (${r.company})` : ""} · ${r.customer_email}${r.customer_phone ? ` · ${r.customer_phone}` : ""}`,
    r.contact_pref ? `Best way to reach them: ${TICKET_CONTACT[r.contact_pref as TicketContact] ?? r.contact_pref}${r.best_time ? ` · ${r.best_time}` : ""}` : null,
    where ? `Where: ${where}` : null,
    `Needs: ${svc?.name ?? "Not sure / several things"}${r.job_type ? ` · ${TICKET_JOB_TYPES[r.job_type as TicketJobType]?.label ?? r.job_type}` : ""}`,
    r.timing ? `When: ${TICKET_TIMING[r.timing as TicketTiming] ?? r.timing}${r.preferred_date ? ` (${r.preferred_date})` : ""}` : null,
    r.details ? `Details: ${r.details}` : null,
    r.relationship ? `Relationship: ${TICKET_RELATIONSHIPS[r.relationship as TicketRelationship] ?? r.relationship}` : null,
    r.note ? `Note to the customer: ${r.note}` : null,
  ].filter(Boolean).join("\n");
}

/** Hub: move a ticket along by hand (we reached out / closed) with an optional note. */
export async function setTicketStatus(id: string, status: Extract<TicketStatus, "submitted" | "contacted" | "closed">, note: string | null, by: string) {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (note) patch.staff_note = `${note} (${by})`.slice(0, 1000);
  const { error } = await db().from("referral_customers").update(patch).eq("id", id);
  return error ? error.message : null;
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
    if (partnerId && !ref.first_job_id) await db().from("referral_customers").update({ first_job_id: job.id, updated_at: new Date().toISOString() }).eq("id", ref.id);
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
  if (!partnerId) return null;
  const tier = partnerTier({ business_account_id: job.business_account_id, frequency: job.frequency, plan_id: job.plan_id, firstJob: await isFirstJob(email, partnerId, job.id) });
  const { error } = await db().from("jobs").update({ partner_id: partnerId, partner_tier: tier }).eq("id", job.id);
  if (error) await db().from("jobs").update({ partner_id: partnerId }).eq("id", job.id); // before the partner-v2 SQL is run
  return partnerId;
}

/** No other (non-cancelled) job from this customer is credited to this partner → this is their first job. */
async function isFirstJob(email: string, partnerId: string, jobId: string) {
  const { count } = await db().from("jobs").select("id", { count: "exact", head: true }).ilike("contact_email", email).eq("partner_id", partnerId).neq("id", jobId).neq("status", "cancelled");
  return (count ?? 0) === 0;
}

// ─── Commissions ─────────────────────────────────────────────────────────────

type Split = { tier: PartnerTier | "legacy"; rate: number; fromPro: number; fromUs: number; amount: number; take: number };

/**
 * At completion, before the pro's payout line is written: the partner's share of this job and who pays it.
 * null when nothing is owed (no partner, a redo, past the 12 months, nothing paid). Saves the pro's half on the job.
 */
export async function partnerSplitForJob(job: Job): Promise<Split | null> {
  if (!job.partner_id || job.remedy || !(Number(job.price_final) > 0)) return null;
  const { data: ref } = await db().from("referral_customers").select("expires_at").eq("customer_email", lower(job.contact_email)).eq("partner_id", job.partner_id).maybeSingle();
  if (!ref || new Date(job.created_at) > new Date(ref.expires_at)) return null; // booked after the 12 months
  const o = { price: Number(job.price_final), payout: Number(job.contractor_payout ?? 0), refunded: Number(job.amount_refunded ?? 0) };
  const take = partnerTake(o);
  if (partnerLegacyJob(job.created_at)) { // partner-v1: 10% of our take, Handled alone
    const amount = partnerCommission(o);
    return amount > 0 ? { tier: "legacy", rate: PARTNER_PROGRAM.legacyPctOfTake, fromPro: 0, fromUs: amount, amount, take } : null;
  }
  const tier = job.partner_tier ?? partnerTier({ business_account_id: job.business_account_id, frequency: job.frequency, plan_id: job.plan_id, firstJob: await isFirstJob(lower(job.contact_email), job.partner_id, job.id) });
  // the pro pays their half only under the agreement that says so (v10+); otherwise our half is all the partner gets
  const { data: pro } = job.contractor_id ? await db().from("contractors").select("agreement_version").eq("id", job.contractor_id).maybeSingle() : { data: null };
  const sp = partnerSplit({ ...o, tier, proPays: pro?.agreement_version === AGREEMENT_VERSION });
  if (sp.amount <= 0) return null;
  if (sp.fromPro > 0) await db().from("jobs").update({ partner_pro_fee: sp.fromPro }).eq("id", job.id);
  return { tier, rate: sp.rate, fromPro: sp.fromPro, fromUs: sp.fromUs, amount: sp.amount, take };
}

/** At completion: record the partner's commission (paid after the make-it-right window). */
export async function accrueCommission(job: Job, sp: Split | null) {
  if (!job.partner_id || !sp) return;
  const done = job.completed_at ? new Date(job.completed_at) : new Date();
  const row = {
    partner_id: job.partner_id, job_id: job.id, take: sp.take, amount: sp.amount, status: "pending",
    eligible_at: new Date(done.getTime() + PARTNER_PROGRAM.holdDays * 86400000).toISOString(),
  };
  const { error } = await db().from("partner_commissions").upsert({ ...row, tier: sp.tier, rate: sp.rate, from_pro: sp.fromPro, from_us: sp.fromUs }, { onConflict: "job_id", ignoreDuplicates: true });
  if (error && /column/i.test(error.message)) await db().from("partner_commissions").upsert(row, { onConflict: "job_id", ignoreDuplicates: true }); // before the partner-v2 SQL
}

type DueJob = { price_final: number; contractor_payout: number; amount_refunded: number; remedy: string | null; status: string; contractor_id: string | null; ref: string };
type DueRow = { id: string; partner_id: string; job_id: string; amount: number; tier: string | null; from_pro: number | null; from_us: number | null; pro_returned: number | null; jobs: DueJob | null };

/**
 * A commission re-checked against the job as it is now (refunds after completion). It only ever goes down. When the
 * pro's half goes down, the difference is handed back to the pro on their next payout.
 */
async function recheckCommission(r: DueRow, voidNote?: string): Promise<number> {
  const j = r.jobs;
  const live = Boolean(j && j.status === "completed" && !j.remedy) && !voidNote;
  const fromPro = Number(r.from_pro ?? 0), fromUs = Number(r.from_us ?? 0);
  let now$: number, newPro = 0, newUs = 0;
  if (!r.tier || r.tier === "legacy") {
    now$ = live ? Math.min(Number(r.amount), partnerCommission({ price: Number(j!.price_final), payout: Number(j!.contractor_payout), refunded: Number(j!.amount_refunded) })) : 0;
    newUs = now$;
  } else {
    const sp = live ? partnerSplit({ price: Number(j!.price_final), payout: Number(j!.contractor_payout), refunded: Number(j!.amount_refunded), tier: r.tier as PartnerTier }) : null;
    newPro = sp && fromPro > 0 ? Math.min(fromPro, sp.fromPro) : 0;
    newUs = sp ? Math.min(fromUs, sp.fromUs) : 0;
    now$ = Math.round((newPro + newUs) * 100) / 100;
  }
  const back = Math.round((fromPro - newPro - Number(r.pro_returned ?? 0)) * 100) / 100;
  if (back > 0 && j?.contractor_id) {
    await db().from("payouts").insert({ contractor_id: j.contractor_id, job_id: r.job_id, amount: back, status: "approved", kind: "partner_fee", reason: `Referral fee handed back — ${j.ref} ${now$ > 0 ? "partly refunded" : "refunded or cancelled"}` });
  }
  if (now$ <= 0) {
    await db().from("partner_commissions").update({ status: "void", amount: 0, note: voidNote ?? "job refunded or cancelled", ...(r.tier ? { from_pro: 0, from_us: 0, pro_returned: Number(r.pro_returned ?? 0) + Math.max(0, back) } : {}) }).eq("id", r.id);
  } else if (now$ !== Number(r.amount)) {
    await db().from("partner_commissions").update({ amount: now$, note: "reduced by a refund", ...(r.tier ? { from_pro: newPro, from_us: newUs, pro_returned: Number(r.pro_returned ?? 0) + Math.max(0, back) } : {}) }).eq("id", r.id);
  }
  return now$;
}

/** Hub: cancel an unpaid commission. The pro's half goes back to them. */
export async function voidCommission(id: string, note: string) {
  const { data } = await db().from("partner_commissions").select("id, partner_id, job_id, amount, tier, from_pro, from_us, pro_returned, status, jobs(price_final, contractor_payout, amount_refunded, remedy, status, contractor_id, ref)").eq("id", id).maybeSingle();
  if (!data || data.status !== "pending") return "Only unpaid commissions can be voided";
  await recheckCommission(data as unknown as DueRow, note);
  return null;
}

const mondayOf = (d: Date) => { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); };

/** Mondays: pay every eligible commission (re-checked against refunds) to partners whose Stripe payouts are ready. */
export async function runPartnerPayouts(now = new Date()) {
  const s = getStripe();
  const week = mondayOf(now);
  const due$ = (cols: string) => db().from("partner_commissions").select(`id, partner_id, job_id, amount, ${cols}jobs(price_final, contractor_payout, amount_refunded, remedy, status, contractor_id, ref)`).eq("status", "pending").lte("eligible_at", now.toISOString()).limit(5000);
  let { data: due, error } = await due$("tier, from_pro, from_us, pro_returned, ");
  if (error) ({ data: due } = await due$("")); // before the partner-v2 SQL is run: every row is partner-v1
  const byPartner = new Map<string, DueRow[]>();
  let voided = 0;
  for (const r of (due ?? []) as unknown as DueRow[]) {
    // refunds after completion → the commission follows them down (never up); the pro's half is handed back to match
    const now$ = await recheckCommission(r);
    if (now$ <= 0) { voided++; continue; }
    r.amount = now$;
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
