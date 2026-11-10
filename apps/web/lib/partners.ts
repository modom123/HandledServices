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
 * UPDATED : 2026-10-29_0715 UTC — a partner who is also a Handled pro is paid into the Stripe account they already use for
 *           job payouts (payoutAccount): no second setup.
 * UPDATED : 2026-10-28_0122 UTC — partner-v2: fixed tiers of the job price split 50/50 pro / Handled; the standard referral ticket.
 * UPDATED : 2026-11-06_1730 UTC — Field Sales (direct sales, lib/sales-tickets.ts): a customer the partner SOLD on a
 *           close-ready sales ticket (referral_customers.source 'sale', jobs.partner_sale) pays the partner the ladder rate
 *           (10% → 45% of Handled's take, from their lifetime direct-sale profit, PARTNER_LADDER) — paid by Handled alone,
 *           no pro fee, tier 'direct'. Referrals keep partner-v2 unchanged. A partner code typed at checkout credits that
 *           partner for a new customer (ahead of a link cookie). partnerStats() returns the direct-sales level.
 * UPDATED : 2026-11-06_1800 UTC — partner-v4 referrals: one rate on every referred job, 15% → 30% of the price from the
 *           partner's level credit (referralLevel), locked on the job at booking (jobs.partner_rate) and used for the split,
 *           the work order and the Monday re-check. A pro pays their half on a partner-v4 job only once they've signed
 *           agreement v11; on older (tier) jobs, v10 is enough.
 * UPDATED : 2026-11-07_1500 UTC — Post & earn: enrollFromPost() signs up someone who posts a project (tick-box on /post)
 *           and claims their own email as source 'self'. attributeJob credits only their FIRST job; partnerSplitForJob pays
 *           firstProjectReward (10% back, up to $250, Handled alone, tier 'self'); self rewards don't build level credit.
 * UPDATED : 2026-11-10_0400 UTC — lead pay: each lead's $10 draw is repaid out of its commission (recoverLeadDraw); pending draws
 *           join the weekly payout once unlocked (10 leads + one paid-out sale, leadPayStatus).
 * UPDATED : 2026-11-10_0430 UTC — "insured pros" → "background-checked, vetted pros" (insurance is only required for services that need it).
 * UPDATED : 2026-11-10_1415 UTC — full partner welcome email (payouts first; core partnerWelcomeEmail) and partnerPayoutReminders()
 *           (daily: days 1, 3, 7 and 14 after sign-up while payouts aren't set up).
 */
import "server-only";
import { cookies } from "next/headers";
import {
  AGREEMENT_VERSION, BRAND, PARTNER_PROGRAM, TICKET_CONTACT, TICKET_JOB_TYPES, TICKET_RELATIONSHIPS, TICKET_TIMING,
  cleanPartnerCode, firstProjectReward, getService, makePartnerCode, makeTicketNo, money, partnerCommission, partnerExpiry, partnerLegacyJob, partnerRateLines,
  REFERRAL_LADDER, ladderCredit, partnerLevel, partnerSaleCommission, partnerSplit, partnerTake, partnerTier, PARTNER_LADDER,
  type Job, type PartnerKind, type PartnerTier, type TicketContact, type TicketJobType, type TicketRelationship, type TicketStatus, type TicketTiming,
  SALES_DRAW, drawRecovery, drawUnlocked, partnerWelcomeEmail, partnerPayoutReminder, payoutReminderDay, PAYOUT_REMINDER_DAYS
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

/**
 * Post & earn: someone posting a project on /post with the box ticked joins the Partner Program, and — when they're new
 * to Handled and nobody referred them first — their own first project earns 10% back, up to $250 (source 'self').
 * Never throws: a lead must never fail because the partner step did.
 */
export async function enrollFromPost(o: { name: string; email: string; phone?: string | null; service_slug?: string | null; ip: string | null }): Promise<{ code: string; reward: boolean } | null> {
  try {
    const email = lower(o.email);
    const { partner } = await signUp({ name: o.name, email, phone: o.phone, kind: "customer", how: "Post your project", ip: o.ip });
    if (partner.status !== "active") return { code: partner.code, reward: false };
    const { data: taken } = await db().from("referral_customers").select("partner_id, source").eq("customer_email", email).maybeSingle();
    if (taken) return { code: partner.code, reward: taken.partner_id === partner.id && taken.source === "self" };
    if (await isExistingCustomer(email)) return { code: partner.code, reward: false };
    const { error } = await db().from("referral_customers").insert({
      partner_id: partner.id, customer_email: email, customer_name: o.name, customer_phone: o.phone || null,
      service_slug: o.service_slug || null, source: "self", note: "Post your project — first-project reward",
      expires_at: partnerExpiry(new Date()).toISOString(),
    });
    return { code: partner.code, reward: !error }; // error: the post-and-earn SQL isn't run yet, or a race
  } catch (e) {
    console.error("enrollFromPost", e);
    return null;
  }
}

/** The partner's code, link and a one-tap sign-in to their partner page (sent at sign-up, and again if they sign up twice). */
async function sendWelcome(partner: Partner, again: boolean) {
  const { signInLink } = await import("./signin");
  const portal = await signInLink(partner.email, "/partner");
  // the full welcome (core partner-welcome.ts): payouts first, code and links, both ways to earn, how the rate climbs,
  // what counts, when they're paid, tips for their kind of partner, the rules. Pros already have a payout account.
  const isPro = await partnerIsPro(partner).catch(() => false);
  const ready = again ? await payoutsReady(partner).catch(() => false) : false;
  const w = partnerWelcomeEmail(partner, { site: siteUrl(), portalUrl: portal, isPro, payoutsReady: ready });
  await sendEmail(partner.email, again ? `Your ${BRAND.name} partner info${ready || isPro ? "" : " (payouts not set up yet)"}` : w.subject, w.text);
}

/**
 * Daily: remind partners whose payouts aren't set up yet, on PAYOUT_REMINDER_DAYS after sign-up (1, 3, 7, 14), with a
 * one-tap link to their partner page and what's already waiting for them. Pros are skipped (they're paid with their
 * job payouts). The Monday run separately emails anyone with money waiting.
 */
export async function partnerPayoutReminders(now = new Date()) {
  const oldest = new Date(now.getTime() - (PAYOUT_REMINDER_DAYS[PAYOUT_REMINDER_DAYS.length - 1] + 1) * 86400000).toISOString();
  const { data } = await db().from("referral_partners").select("*").eq("status", "active").gte("created_at", oldest).limit(2000);
  let sent = 0;
  for (const partner of (data ?? []) as Partner[]) {
    const day = payoutReminderDay(partner.created_at, now);
    if (day === null) continue;
    if (await partnerIsPro(partner).catch(() => false)) continue;
    if (await payoutsReady(partner).catch(() => false)) continue;
    const { data: owed } = await db().from("partner_commissions").select("amount").eq("partner_id", partner.id).eq("status", "pending");
    const waiting = Math.round(((owed ?? []) as { amount: number }[]).reduce((t, r) => t + Number(r.amount), 0) * 100) / 100;
    const { signInLink } = await import("./signin");
    const r = partnerPayoutReminder(partner, { portalUrl: await signInLink(partner.email, "/partner"), day, waiting: waiting || undefined });
    if (await sendEmail(partner.email, r.subject, r.text).catch(() => false)) sent++;
  }
  return { sent };
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
  /** Up to 8 photos of the job (paths from /api/uploads). */
  photos?: string[];
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
    ...(t.photos?.length ? { photos: t.photos } : {}),
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
    `Hi ${t.name.split(" ")[0]},\n\n${partner.name}${partner.company ? ` (${partner.company})` : ""} thought you'd like ${BRAND.name}${svc ? ` for your ${svc.name.toLowerCase()}` : ""}: background-checked, vetted local pros, an upfront price in 60 seconds, photo proof when it's done, and a free redo if anything's missed.\n\nSee your price and book: ${book}\n${t.note ? `\nNote from ${partner.name.split(" ")[0]}: ${t.note}\n` : ""}\nWe'll also reach out by ${TICKET_CONTACT[t.contact_pref].toLowerCase()}${t.best_time ? ` (${t.best_time})` : ""}. Questions? Just reply.\n\n— ${BRAND.name}`).catch(() => {});
  const summary = ticketText({ ...row, ticket_no: ticketNo });
  await sendEmail(partner.email, `Referral ticket ${ticketNo} received — ${t.name}`, `Hi ${partner.name.split(" ")[0]},\n\nThanks — we've got it. We emailed ${t.name.split(" ")[0]} a booking link from you and we'll reach out ourselves too.\n\n${summary}\n\nWhat you'll earn: ${TICKET_JOB_TYPES[t.job_type].earns}.\n\nFollow this ticket: ${siteUrl()}/partner\n\n— ${BRAND.name}`).catch(() => {});
  if (opsEmail()) await sendEmail(opsEmail(), `Referral ticket ${ticketNo}: ${t.name}${svc ? ` — ${svc.name}` : ""} (${partner.name})`, `${summary}${t.photos?.length ? `\n${t.photos.length} photo(s) of the job: see the ticket in Hub → Partners` : ""}\n\nPartner: ${partner.name}${partner.company ? ` (${partner.company})` : ""} · ${partner.email} · code ${partner.code}\n\nReach out by ${TICKET_CONTACT[t.contact_pref].toLowerCase()}, then mark it "We reached out" in Hub → Partners: ${siteUrl()}/hub/partners`).catch(() => {});
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
export async function attributeJob(job: Job, typedCode?: string | null): Promise<string | null> {
  const email = lower(job.contact_email);
  const { data: ref } = await db().from("referral_customers").select("id, partner_id, first_job_id, expires_at, source, referral_partners(status)").eq("customer_email", email).maybeSingle();
  let partnerId: string | null = null;
  if (ref) {
    const active = (ref.referral_partners as unknown as { status: string } | null)?.status === "active";
    // the partner's own project (Post & earn): only their first job, and only while they're new to Handled
    if (ref.source === "self" && ((ref.first_job_id && ref.first_job_id !== job.id) || await isExistingCustomer(email, job.id))) return null;
    if (active && new Date(ref.expires_at) > new Date()) partnerId = ref.partner_id;
    if (partnerId && !ref.first_job_id) await db().from("referral_customers").update({ first_job_id: job.id, updated_at: new Date().toISOString() }).eq("id", ref.id);
  } else {
    // the partner code the customer typed at checkout wins over a link clicked earlier
    let code: string | null = (await partnerByCode(typedCode))?.code ?? null;
    if (!code) try { code = cleanPartnerCode((await cookies()).get(PARTNER_COOKIE)?.value); } catch { /* not in a request (cron, app) */ }
    if (!code) return null;
    const { data: p } = await db().from("referral_partners").select("id, email, status").eq("code", code).maybeSingle();
    if (!p || p.status !== "active" || p.email === email) return null;
    if (await isExistingCustomer(email, job.id)) return null;
    const { error } = await db().from("referral_customers").insert({ partner_id: p.id, customer_email: email, customer_name: job.contact_name, customer_phone: job.contact_phone, service_slug: job.service_slug, source: "link", first_job_id: job.id, expires_at: partnerExpiry(new Date()).toISOString() });
    if (error) return null; // someone else claimed this customer a moment ago
    partnerId = p.id;
  }
  if (!partnerId) return null;
  // the partner's own first project: the first-project reward, paid by Handled alone — no tier, no rate, no pro fee
  if (ref?.source === "self") {
    await db().from("jobs").update({ partner_id: partnerId, partner_tier: null }).eq("id", job.id);
    return partnerId;
  }
  // a customer the partner sold on a sales ticket: direct-sale ladder, paid by Handled alone — no tier, no pro fee
  if (ref?.source === "sale") {
    const { error } = await db().from("jobs").update({ partner_id: partnerId, partner_tier: null, partner_sale: true }).eq("id", job.id);
    if (error) await db().from("jobs").update({ partner_id: partnerId }).eq("id", job.id);
    return partnerId;
  }
  const tier = partnerTier({ business_account_id: job.business_account_id, frequency: job.frequency, plan_id: job.plan_id, firstJob: await isFirstJob(email, partnerId, job.id) });
  // partner-v4: lock the partner's referral rate (15%–30%) on the job now, so the pro sees their half before accepting
  const rate = await referralRateNow(partnerId);
  let { error } = await db().from("jobs").update({ partner_id: partnerId, partner_tier: tier, partner_rate: rate }).eq("id", job.id);
  if (error) ({ error } = await db().from("jobs").update({ partner_id: partnerId, partner_tier: tier }).eq("id", job.id)); // before the partner-v4 SQL
  if (error) await db().from("jobs").update({ partner_id: partnerId }).eq("id", job.id); // before the partner-v2 SQL is run
  return partnerId;
}

/** No other (non-cancelled) job from this customer is credited to this partner → this is their first job. */
async function isFirstJob(email: string, partnerId: string, jobId: string) {
  const { count } = await db().from("jobs").select("id", { count: "exact", head: true }).ilike("contact_email", email).eq("partner_id", partnerId).neq("id", jobId).neq("status", "cancelled");
  return (count ?? 0) === 0;
}

// ─── Commissions ─────────────────────────────────────────────────────────────

type Split = { tier: PartnerTier | "legacy" | "direct" | "self"; rate: number; fromPro: number; fromUs: number; amount: number; take: number };

/**
 * At completion, before the pro's payout line is written: the partner's share of this job and who pays it.
 * null when nothing is owed (no partner, a redo, past the 12 months, nothing paid). Saves the pro's half on the job.
 */
export async function partnerSplitForJob(job: Job): Promise<Split | null> {
  if (!job.partner_id || job.remedy || !(Number(job.price_final) > 0)) return null;
  const { data: ref } = await db().from("referral_customers").select("expires_at, source").eq("customer_email", lower(job.contact_email)).eq("partner_id", job.partner_id).maybeSingle();
  if (!ref || new Date(job.created_at) > new Date(ref.expires_at)) return null; // booked after the 12 months
  const o = { price: Number(job.price_final), payout: Number(job.contractor_payout ?? 0), refunded: Number(job.amount_refunded ?? 0) };
  const take = partnerTake(o);
  // Post & earn: the partner's own first project — 10% back, up to $250, Handled alone
  if (ref.source === "self") {
    const amount = firstProjectReward(o);
    return amount > 0 ? { tier: "self", rate: 0.1, fromPro: 0, fromUs: amount, amount, take } : null;
  }
  // direct sale (Field Sales): the partner's ladder rate of our take, paid by Handled alone
  if (ref.source === "sale" || (job as { partner_sale?: boolean }).partner_sale) {
    const { rate } = await directSalesLevel(job.partner_id);
    const gross = partnerSaleCommission(o, rate);
    // lead pay: this lead's $10 draw was an advance — it comes back out of this commission
    const amount = Math.round((gross - await recoverLeadDraw(job.partner_id, job, gross).catch(() => 0)) * 100) / 100;
    return gross > 0 ? { tier: "direct", rate, fromPro: 0, fromUs: amount, amount, take } : null;
  }
  if (partnerLegacyJob(job.created_at)) { // partner-v1: 10% of our take, Handled alone
    const amount = partnerCommission(o);
    return amount > 0 ? { tier: "legacy", rate: PARTNER_PROGRAM.legacyPctOfTake, fromPro: 0, fromUs: amount, amount, take } : null;
  }
  const tier = job.partner_tier ?? partnerTier({ business_account_id: job.business_account_id, frequency: job.frequency, plan_id: job.plan_id, firstJob: await isFirstJob(lower(job.contact_email), job.partner_id, job.id) });
  // the pro pays their half only under the agreement that says so: v11+ for a partner-v4 job (its rate is on the job),
  // v10+ for an older tier job; otherwise our half is all the partner gets
  const rate = job.partner_rate != null ? Number(job.partner_rate) : null;
  const { data: pro } = job.contractor_id ? await db().from("contractors").select("agreement_version").eq("id", job.contractor_id).maybeSingle() : { data: null };
  const signed = String(pro?.agreement_version ?? "");
  const proPays = rate != null ? signed >= AGREEMENT_VERSION : signed >= "2026-10-v10";
  const sp = partnerSplit({ ...o, tier, rate, proPays });
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
type DueRow = { id: string; partner_id: string; job_id: string; amount: number; rate?: number | null; tier: string | null; from_pro: number | null; from_us: number | null; pro_returned: number | null; jobs: DueJob | null };

/**
 * A commission re-checked against the job as it is now (refunds after completion). It only ever goes down. When the
 * pro's half goes down, the difference is handed back to the pro on their next payout.
 */
async function recheckCommission(r: DueRow, voidNote?: string): Promise<number> {
  const j = r.jobs;
  const live = Boolean(j && j.status === "completed" && !j.remedy) && !voidNote;
  const fromPro = Number(r.from_pro ?? 0), fromUs = Number(r.from_us ?? 0);
  let now$: number, newPro = 0, newUs = 0;
  if (r.tier === "self") { // Post & earn: the first-project reward, Handled alone
    now$ = live ? Math.min(Number(r.amount), firstProjectReward({ price: Number(j!.price_final), payout: Number(j!.contractor_payout), refunded: Number(j!.amount_refunded) })) : 0;
    newUs = now$;
  } else if (r.tier === "direct") { // direct sale: the locked ladder rate of our take, Handled alone
    now$ = live ? Math.min(Number(r.amount), partnerSaleCommission({ price: Number(j!.price_final), payout: Number(j!.contractor_payout), refunded: Number(j!.amount_refunded) }, Number(r.rate ?? PARTNER_LADDER.baseRate))) : 0;
    newUs = now$;
  } else if (!r.tier || r.tier === "legacy") {
    now$ = live ? Math.min(Number(r.amount), partnerCommission({ price: Number(j!.price_final), payout: Number(j!.contractor_payout), refunded: Number(j!.amount_refunded) })) : 0;
    newUs = now$;
  } else {
    const sp = live ? partnerSplit({ price: Number(j!.price_final), payout: Number(j!.contractor_payout), refunded: Number(j!.amount_refunded), tier: r.tier as PartnerTier, rate: r.rate ?? null }) : null;
    newPro = sp && fromPro > 0 ? Math.min(fromPro, sp.fromPro) : 0;
    newUs = sp ? Math.min(fromUs, sp.fromUs) : 0;
    now$ = Math.round((newPro + newUs) * 100) / 100;
  }
  const back = Math.round((fromPro - newPro - Number(r.pro_returned ?? 0)) * 100) / 100;
  if (back > 0 && j?.contractor_id) {
    await db().from("payouts").insert({ contractor_id: j.contractor_id, job_id: r.job_id, amount: back, status: "approved", kind: "partner_fee", reason: `Pay adjustment — ${j.ref}` });
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
  const { data } = await db().from("partner_commissions").select("id, partner_id, job_id, amount, rate, tier, from_pro, from_us, pro_returned, status, jobs(price_final, contractor_payout, amount_refunded, remedy, status, contractor_id, ref)").eq("id", id).maybeSingle();
  if (!data || data.status !== "pending") return "Only unpaid commissions can be voided";
  await recheckCommission(data as unknown as DueRow, note);
  return null;
}

const mondayOf = (d: Date) => { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); };

/**
 * Where a partner's commissions go: their own Stripe account, or — for a partner who is also a Handled pro (same email)
 * — the account they already use for job payouts. Remembered on the partner once found.
 */
export async function payoutAccount(partner: Partner): Promise<string | null> {
  if (partner.stripe_account_id) return partner.stripe_account_id;
  const { data: pro } = await db().from("contractors").select("stripe_account_id").eq("email", partner.email).not("stripe_account_id", "is", null).maybeSingle();
  const acct = (pro?.stripe_account_id as string | null) ?? null;
  if (acct) { await db().from("referral_partners").update({ stripe_account_id: acct }).eq("id", partner.id); partner.stripe_account_id = acct; }
  return acct;
}

/** Is this partner a Handled pro (paid with their job payouts)? */
export async function partnerIsPro(partner: Partner): Promise<boolean> {
  const { count } = await db().from("contractors").select("id", { count: "exact", head: true }).eq("email", partner.email);
  return (count ?? 0) > 0;
}

/** Mondays: pay every eligible commission (re-checked against refunds) to partners whose Stripe payouts are ready. */
/** The lead's draw for this job (its sales ticket), repaid out of the commission. Returns what was taken back. */
async function recoverLeadDraw(partnerId: string, job: Job, commission: number): Promise<number> {
  const { data: tix } = await db().from("sales_tickets").select("id").eq("partner_id", partnerId).or(`job_id.eq.${job.id},customer_email.eq.${lower(job.contact_email)}`).limit(5);
  const ids = ((tix ?? []) as { id: string }[]).map((t) => t.id);
  if (!ids.length) return 0;
  const { data: draws } = await db().from("partner_draws").select("id, amount, recovered").in("ticket_id", ids).neq("status", "void");
  let left = commission, taken = 0;
  for (const d of (draws ?? []) as { id: string; amount: number; recovered: number }[]) {
    const r = drawRecovery({ commission: left, drawOutstanding: Number(d.amount) - Number(d.recovered) });
    if (r <= 0) continue;
    await db().from("partner_draws").update({ recovered: Math.round((Number(d.recovered) + r) * 100) / 100 }).eq("id", d.id);
    left -= r; taken += r;
  }
  return Math.round(taken * 100) / 100;
}

/** Lead pay status for a partner: leads written, paid-out sales, unlocked?, and what's waiting / paid. */
export async function leadPayStatus(partnerId: string) {
  const [{ data: draws }, { count: paidSales }] = await Promise.all([
    db().from("partner_draws").select("amount, recovered, status").eq("partner_id", partnerId).neq("status", "void"),
    db().from("partner_commissions").select("id", { count: "exact", head: true }).eq("partner_id", partnerId).eq("tier", "direct").eq("status", "paid"),
  ]);
  const rows = (draws ?? []) as { amount: number; recovered: number; status: string }[];
  const net = (r: { amount: number; recovered: number }) => Math.max(0, Number(r.amount) - Number(r.recovered));
  const leads = rows.length;
  return {
    leads, paidSales: paidSales ?? 0, unlocked: drawUnlocked({ leads, paidSales: paidSales ?? 0 }),
    waiting: Math.round(rows.filter((r) => r.status === "pending").reduce((t, r) => t + net(r), 0) * 100) / 100,
    paid: Math.round(rows.filter((r) => r.status === "paid").reduce((t, r) => t + Number(r.amount), 0) * 100) / 100,
  };
}

export async function runPartnerPayouts(now = new Date()) {
  const s = getStripe();
  const week = mondayOf(now);
  const due$ = (cols: string) => db().from("partner_commissions").select(`id, partner_id, job_id, amount, ${cols}jobs(price_final, contractor_payout, amount_refunded, remedy, status, contractor_id, ref)`).eq("status", "pending").lte("eligible_at", now.toISOString()).limit(5000);
  let { data: due, error } = await due$("rate, tier, from_pro, from_us, pro_returned, ");
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
  // lead pay: pending draws of partners whose lead pay is unlocked (10 leads + one paid-out sale), net of anything repaid
  const drawsBy = new Map<string, { id: string; net: number }[]>();
  const { data: pend, error: drawErr } = await db().from("partner_draws").select("id, partner_id, amount, recovered").eq("status", "pending").limit(5000);
  if (!drawErr) {
    const byP = new Map<string, { id: string; net: number }[]>();
    for (const d of (pend ?? []) as { id: string; partner_id: string; amount: number; recovered: number }[]) byP.set(d.partner_id, [...(byP.get(d.partner_id) ?? []), { id: d.id, net: Math.max(0, Math.round((Number(d.amount) - Number(d.recovered)) * 100) / 100) }]);
    for (const [pid, ds] of byP) if ((await leadPayStatus(pid)).unlocked) drawsBy.set(pid, ds);
  }
  for (const pid of drawsBy.keys()) if (!byPartner.has(pid)) byPartner.set(pid, []);
  let paid = 0, total = 0, waiting = 0;
  const failed: string[] = [];
  let funds = await availableBalance(); // card money takes ~2 days to become available in Stripe
  for (const [pid, rows] of byPartner) {
    const draws = drawsBy.get(pid) ?? [];
    const drawTotal = Math.round(draws.reduce((t, d) => t + d.net, 0) * 100) / 100;
    const amount = Math.round((rows.reduce((t, r) => t + Number(r.amount), 0) + drawTotal) * 100) / 100;
    if (amount < PARTNER_PROGRAM.minPayout) continue; // rolls to next week
    const { data: p } = await db().from("referral_partners").select("*").eq("id", pid).single();
    const partner = p as Partner;
    if (partner.status !== "active") continue;
    const acct = await payoutAccount(partner);
    const ready = s && acct ? Boolean((await s.accounts.retrieve(acct).catch(() => null))?.payouts_enabled) : false;
    if (!s || !ready) {
      waiting++;
      const isPro = await partnerIsPro(partner);
      await sendEmail(partner.email, `${money(amount)} in referral commissions is ready for you`, `Hi ${partner.name.split(" ")[0]},\n\nYou have ${money(amount)} in ${BRAND.name} referral commissions ready to send. ${isPro ? `Finish your payout setup in your pro account and it goes to the same bank as your job pay: ${siteUrl()}/pro/onboarding#step-payout` : `Set up payouts (2 minutes, through Stripe) on your partner page: ${siteUrl()}/partner`}\n\n— ${BRAND.name}`).catch(() => {});
      continue;
    }
    if (funds !== null && funds < amount) { failed.push(`${partner.name}: not enough available in Stripe yet — waits for next week`); continue; }
    const ids = rows.map((r) => r.id);
    const drawIds = draws.map((d) => d.id);
    const stamp = new Date().toISOString();
    const { data: claimed } = ids.length ? await db().from("partner_commissions").update({ status: "paid", paid_at: stamp, week_of: week }).in("id", ids).eq("status", "pending").select("id") : { data: [] };
    const { data: claimedDraws } = drawIds.length ? await db().from("partner_draws").update({ status: "paid", paid_at: stamp, week_of: week }).in("id", drawIds).eq("status", "pending").select("id") : { data: [] };
    if ((claimedDraws ?? []).length !== drawIds.length) {
      if (claimedDraws?.length) await db().from("partner_draws").update({ status: "pending", paid_at: null, week_of: null }).in("id", claimedDraws.map((x: { id: string }) => x.id));
      if (claimed?.length) await db().from("partner_commissions").update({ status: "pending", paid_at: null, week_of: null }).in("id", claimed.map((x: { id: string }) => x.id));
      failed.push(`${partner.name} (lead pay changed while paying)`);
      continue;
    }
    if ((claimed ?? []).length !== ids.length) {
      if (drawIds.length) await db().from("partner_draws").update({ status: "pending", paid_at: null, week_of: null }).in("id", drawIds);
      if (claimed?.length) await db().from("partner_commissions").update({ status: "pending", paid_at: null, week_of: null }).in("id", claimed.map((x: { id: string }) => x.id));
      failed.push(`${partner.name} (changed while paying)`);
      continue;
    }
    let t: { id: string };
    try {
      t = await s.transfers.create({ amount: Math.round(amount * 100), currency: "usd", destination: acct!, description: `${BRAND.name} referral commissions — week of ${week}`, metadata: { partner_id: pid, kind: "partner_commission", week_of: week } }, { idempotencyKey: `partner-${pid}-${week}-${stamp}` });
    } catch (e) {
      if (ids.length) await db().from("partner_commissions").update({ status: "pending", paid_at: null, week_of: null }).in("id", ids);
      if (drawIds.length) await db().from("partner_draws").update({ status: "pending", paid_at: null, week_of: null }).in("id", drawIds);
      failed.push(`${partner.name}: ${e instanceof Error ? e.message : "transfer failed"}`);
      continue;
    }
    // money has moved: problems after this are reported, never undone (undoing would pay twice next week)
    paid++; total = Math.round((total + amount) * 100) / 100;
    if (funds !== null) funds = Math.round((funds - amount) * 100) / 100;
    try {
      if (ids.length) await db().from("partner_commissions").update({ stripe_transfer_id: t.id }).in("id", ids);
      if (drawIds.length) await db().from("partner_draws").update({ stripe_transfer_id: t.id }).in("id", drawIds);
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
  const acct = s ? await payoutAccount(partner) : null;
  if (!s || !acct) return false;
  return Boolean((await s.accounts.retrieve(acct).catch(() => null))?.payouts_enabled);
}

/**
 * The partner's ladder level (the rate their direct sales pay). Both ways to earn build it: lifetime profit generated
 * for Handled (our take on their commissions that weren't voided) — direct sales count 1.5×, referrals 1× — and the
 * same weighting for the job-count fast track. Levels never go down: the best direct-sale rate ever locked is kept.
 */
export async function directSalesLevel(partnerId: string) {
  const { data } = await db().from("partner_commissions").select("take, rate, tier").eq("partner_id", partnerId).neq("status", "void").limit(100000);
  const rows = (data ?? []) as { take: number; rate: number | null; tier: string | null }[];
  // the first-project reward (tier 'self') is the partner's own job: it pays, but doesn't build level credit
  const direct = rows.filter((r) => r.tier === "direct"), referral = rows.filter((r) => r.tier !== "direct" && r.tier !== "self");
  const add = (xs: typeof rows) => Math.round(xs.reduce((t, r) => t + Number(r.take), 0) * 100) / 100;
  const raw = { directProfit: add(direct), referralProfit: add(referral), directJobs: direct.length, referralJobs: referral.length };
  const credit = ladderCredit(raw);
  const lv = partnerLevel(credit.profit, credit.jobs);
  const best = direct.reduce((m, r) => Math.max(m, Number(r.rate ?? 0)), 0);
  return { ...lv, rate: Math.max(lv.rate, Math.min(best, PARTNER_LADDER.topRate)), profit: credit.profit, jobs: credit.jobs, raw };
}

/** The partner's referral rate right now (partner-v4): 15% → 30% of the job price, from the same level credit. */
export async function referralRateNow(partnerId: string): Promise<number> {
  return (await referralLevel(partnerId).catch(() => null))?.rate ?? REFERRAL_LADDER.baseRate;
}

/** The referral ladder level (same credit as direct sales: direct-sale profit 1.5×, referral profit 1×). */
export async function referralLevel(partnerId: string) {
  const d = await directSalesLevel(partnerId);
  const credit = ladderCredit(d.raw);
  return { ...partnerLevel(credit.profit, credit.jobs, REFERRAL_LADDER), profit: credit.profit, jobs: credit.jobs };
}

/** Booking code box: is this an active partner's code? (The customer pays with their rep's code: credit, no discount.) */
export async function partnerByCode(raw: string | null | undefined): Promise<{ name: string; code: string } | null> {
  const code = cleanPartnerCode(raw);
  if (!code) return null;
  const { data } = await db().from("referral_partners").select("name, code, status").eq("code", code).maybeSingle();
  return data && data.status === "active" ? { name: String(data.name), code: String(data.code) } : null;
}

/** Totals for the partner page and the Hub. */
export async function partnerStats(partnerId: string) {
  const [{ count: customers }, { data: comms }, level] = await Promise.all([
    db().from("referral_customers").select("id", { count: "exact", head: true }).eq("partner_id", partnerId),
    db().from("partner_commissions").select("amount, status, eligible_at, tier").eq("partner_id", partnerId),
    directSalesLevel(partnerId).catch(() => partnerLevel(0)),
  ]);
  const now = Date.now();
  const sum = (f: (r: { amount: number; status: string; eligible_at: string }) => boolean) => Math.round(((comms ?? []) as { amount: number; status: string; eligible_at: string }[]).filter(f).reduce((t, r) => t + Number(r.amount), 0) * 100) / 100;
  return {
    customers: customers ?? 0,
    paid: sum((r) => r.status === "paid"),
    ready: sum((r) => r.status === "pending" && new Date(r.eligible_at).getTime() <= now),
    upcoming: sum((r) => r.status === "pending" && new Date(r.eligible_at).getTime() > now),
    jobs: (comms ?? []).filter((r: { status: string }) => r.status !== "void").length,
    level: { profit: 0, jobs: 0, ...level },
    /** partner-v4 referral rate (15% → 30% of the price) from the same level credit. */
    referral: partnerLevel(Number((level as { profit?: number }).profit ?? 0), Number((level as { jobs?: number }).jobs ?? 0), REFERRAL_LADDER),
    bySource: {
      direct: sum((r) => r.status !== "void" && (r as { tier?: string | null }).tier === "direct"),
      referral: sum((r) => r.status !== "void" && (r as { tier?: string | null }).tier !== "direct"),
    },
  };
}
