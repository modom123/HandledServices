/*
 * FILE    : packages/core/src/partners.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0100 UTC
 * PURPOSE : Referral Partner Program rules, shared by web, app and Hub. Anyone (realtors, property managers,
 *           contractors, neighbors) can sign up, share their link or send us a customer, and earn:
 *             • 10% of Handled's take (price − pro payout − refunds) on every completed job from that customer,
 *             • for 12 months from the first referral,
 *             • paid in the weekly Stripe run once the job is past the 30-day make-it-right window.
 *           Since 2026-10-22_0900 the bonus is shared half Handled / half the pro on the job (REFERRAL_COST_SPLIT below);
 *           it's always a share of OUR take, so a referred job can never lose money.
 * UPDATED : 2026-10-22_0400 UTC — referral tickets: pros, clients and anyone can send us one specific job. A one-time job
 *           pays 20% of our take on that job; a recurring job 15% on every visit of that plan for 12 months.
 *           moneySplit() shows who gets what on a job. Terms v2.
 * UPDATED : 2026-10-22_0700 UTC — inviteDays: a ticket invite sent after a phone call works for 30 days.
 * UPDATED : 2026-10-22_0900 UTC — the referral bonus is SHARED: half from Handled's take, half from the pro who does the job
 *           (REFERRAL_COST_SPLIT, referralCostShares). The bonus is still a share of Handled's take, worked out on the
 *           pro's full pay, so the pro's half never feeds back into it. Applies to jobs accepted from the effective date
 *           (30 days' notice) under agreement v10+; before that, or with no pro on the job, Handled carries all of it.
 */
import { BRAND } from "./brand.ts";

export const PARTNER_PROGRAM = {
  pctOfTake: 0.1,          // refer a person: 10% of what Handled keeps on every job from them
  jobOncePct: 0.2,         // refer a one-time job: 20% of what Handled keeps on that job
  jobRecurringPct: 0.15,   // refer a recurring job: 15% on every visit of that plan
  months: 12,              // a referred person, or a referred recurring job, pays for this long
  ticketDays: 60,          // a referral ticket must be booked within this long
  inviteDays: 30,          // a ticket invite (sent after a phone call) works this long
  holdDays: BRAND.guaranteeDays, // paid after the make-it-right window, so refunds come first
  minPayout: 25,           // smaller balances roll to the next weekly run (keeps Stripe fees sensible)
  cookieDays: 90,          // a click on a partner link counts for this long
  termsVersion: "partner-v2",
} as const;

export const PARTNER_KINDS = {
  realtor: "Real estate agent",
  property_manager: "Property manager / HOA",
  contractor: "Contractor or tradesperson",
  business: "Business owner",
  customer: "Handled customer",
  pro: "Handled pro",
  other: "Someone else",
} as const;
export type PartnerKind = keyof typeof PARTNER_KINDS;

/** What a commission was earned for: the customer (a referred person) or one specific referred job. */
export const COMMISSION_BASIS = {
  person: { label: "Referred customer", pct: PARTNER_PROGRAM.pctOfTake },
  job_once: { label: "Referral ticket (one-time job)", pct: PARTNER_PROGRAM.jobOncePct },
  job_recurring: { label: "Referral ticket (recurring job)", pct: PARTNER_PROGRAM.jobRecurringPct },
} as const;
export type CommissionBasis = keyof typeof COMMISSION_BASIS;

/** A ticket pays by what the customer actually booked: one visit, or a recurring plan. */
export function jobReferralBasis(frequency: string): Exclude<CommissionBasis, "person"> {
  return frequency === "once" ? "job_once" : "job_recurring";
}

const cents = (n: number) => Math.round(n * 100);

/** What Handled keeps on a job after the pro's payout and any refunds (never below 0). */
export function partnerTake(o: { price: number; payout: number; refunded?: number }): number {
  return Math.max(0, cents(o.price) - cents(o.payout) - cents(o.refunded ?? 0)) / 100;
}

/** The partner's commission on a job: a share of our take (10% by default), rounded down to the cent. */
export function partnerCommission(o: { price: number; payout: number; refunded?: number }, pct: number = PARTNER_PROGRAM.pctOfTake): number {
  const rate = Math.min(0.5, Math.max(0, Number(pct) || 0)); // never more than half our take
  return Math.floor(cents(partnerTake(o)) * rate + 1e-6) / 100; // + 1e-6: 0.15 isn't exact in binary, don't lose a cent to it
}

/** A partner code: letters from the name + 4 random characters, e.g. "JANE7K2Q". No look-alike characters. */
export function makePartnerCode(name: string, rand: () => number = Math.random): string {
  const head = name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5) || "HND";
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let tail = "";
  for (let i = 0; i < 4; i++) tail += abc[Math.floor(rand() * abc.length)];
  return head + tail;
}

/** Codes are case-insensitive; anything that isn't a plausible code is ignored. */
export function cleanPartnerCode(v: unknown): string | null {
  const s = String(v ?? "").trim().toUpperCase();
  return /^[A-Z0-9]{4,16}$/.test(s) ? s : null;
}

/**
 * Who carries a referral bonus: half Handled (out of its take), half the pro who does the job (out of their payout).
 * The pro's part starts with jobs accepted on/after `effectiveFrom` (30 days' notice under the contractor agreement) by a
 * pro who signed agreement v`minAgreement` or later; until then Handled carries the whole bonus, as before.
 */
export const REFERRAL_COST_SPLIT = { pro: 0.5, handled: 0.5, effectiveFrom: "2026-11-22T00:00:00Z", minAgreement: 10 } as const;

/** Split a referral bonus: the pro's half rounded DOWN to the cent, Handled covers the odd cent. Always sums exactly. */
export function referralCostShares(commission: number, proPays = true): { pro: number; handled: number } {
  const c = Math.max(0, Math.round(Number(commission || 0) * 100));
  const pro = proPays ? Math.floor(c * REFERRAL_COST_SPLIT.pro + 1e-6) : 0;
  return { pro: pro / 100, handled: (c - pro) / 100 };
}

/** The number in an agreement version like "2026-10-v10" (0 when unknown). */
export const agreementNumber = (v: string | null | undefined) => Number(/-v(\d+)$/.exec(String(v ?? ""))?.[1] ?? 0);

/** Does the pro on this job carry half the referral bonus? Accepted on/after the effective date, under agreement v10+. */
export function proSharesReferral(o: { acceptedAt: string | Date | null | undefined; agreementVersion: string | null | undefined }): boolean {
  if (!o.acceptedAt) return false; // never saw an offer with the share on it → Handled carries it
  return new Date(o.acceptedAt).getTime() >= Date.parse(REFERRAL_COST_SPLIT.effectiveFrom) && agreementNumber(o.agreementVersion) >= REFERRAL_COST_SPLIT.minAgreement;
}

/** What the pro's half would be on a job (for the offer and work order, before it's accepted). */
export function referralShareEstimate(o: { price: number; payout: number }, pct: number): number {
  return referralCostShares(partnerCommission(o, pct)).pro;
}

/** A rate as a whole percent for copy ("15", never "15.000000000000002"). */
export const pctLabel = (pct: number) => String(Math.round(pct * 1000) / 10);

/** How long the customer has to book a referral ticket. */
export function ticketExpiry(start: Date): Date {
  return new Date(start.getTime() + PARTNER_PROGRAM.ticketDays * 86400000);
}

/** The customer's booking-link token for a ticket: 24 lower-case letters and digits (unguessable, URL-safe). */
export function makeTicketToken(rand: () => number = Math.random): string {
  const abc = "abcdefghijkmnpqrstuvwxyz23456789";
  let t = "";
  for (let i = 0; i < 24; i++) t += abc[Math.floor(rand() * abc.length)];
  return t;
}
export const cleanTicketToken = (v: unknown): string | null => (/^[a-z0-9]{16,40}$/.test(String(v ?? "")) ? String(v) : null);

/**
 * Where the money on a referred job goes. `payout` is the pro's FULL pay for the job (what the bonus is worked out on);
 * with `proPays`, half the bonus comes out of it. Always: customer = pro + referrer + handled, to the cent.
 */
export function moneySplit(o: { price: number; payout: number; refunded?: number }, pct: number, proPays = false) {
  const referrer = partnerCommission(o, pct);
  const take = partnerTake(o);
  const share = referralCostShares(referrer, proPays);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const customer = r2(o.price - (o.refunded ?? 0));
  const pro = r2(o.payout - share.pro);
  return { customer, pro, referrer, handled: r2(customer - pro - referrer), proShare: share.pro, handledShare: share.handled, take };
}

/** When a referral stops paying (12 months after it started). */
export function partnerExpiry(start: Date): Date {
  const d = new Date(start);
  d.setUTCMonth(d.getUTCMonth() + PARTNER_PROGRAM.months);
  return d;
}

/** The partner terms shown at sign-up (plain English). */
export function partnerTerms(): string[] {
  const p = PARTNER_PROGRAM;
  return [
    `Refer a person: you earn ${pctLabel(p.pctOfTake)}% of ${BRAND.name}'s fee (the job price minus what the pro is paid and any refunds) on every completed job from a customer you refer, for ${p.months} months from their first referral.`,
    `Refer a job with a referral ticket: you earn ${pctLabel(p.jobOncePct)}% of ${BRAND.name}'s fee on a one-time job, or ${pctLabel(p.jobRecurringPct)}% on every visit of a recurring job (weekly, every two weeks, monthly or quarterly) for ${p.months} months from when it's booked. The customer must book from the link we send them (or with the email on the ticket) within ${p.ticketDays} days. Only send a ticket the customer asked you to send. A job pays one commission only, and a customer already referred by another partner can't be sent on a ticket.`,
    `A customer counts as yours when they book through your link (within ${p.cookieDays} days of clicking it) or after you send them to us from your partner page, and they are new to ${BRAND.name}. Each customer belongs to one partner: the first one.`,
    `Commissions are paid weekly through Stripe once the job is ${p.holdDays} days past completion (our make-it-right window). Balances under $${p.minPayout} carry over to the next week. Refunds and chargebacks reduce or cancel the commission on that job.`,
    "Referring yourself, your own household or your own business doesn't count. No spam, fake reviews, or promises about price or service that we didn't make. Breaking these rules ends the partnership and any unpaid commissions.",
    `You're an independent referral partner, not an employee or agent of ${BRAND.name}. If we pay you $600 or more in a year, we'll need your tax details (collected by Stripe) and send you a 1099.`,
    "We may change these terms with 30 days' notice by email. Commissions already earned are paid under the terms in place when the job was booked.",
  ];
}
