/*
 * FILE    : packages/core/src/partners.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0100 UTC
 * PURPOSE : Referral Partner Program rules, shared by web, app and Hub. Anyone (realtors, property managers,
 *           contractors, neighbors) can sign up, share their link or send us a customer on a referral ticket, and earn
 *           a fixed percentage of the job price — the same rate on every service:
 *             • 25% of a referred customer's first job when it's a one-time job,
 *             • 10% of every repeat or recurring job for 12 months,
 *             • 15% of every job on a referred business / property account for 12 months.
 *           The pro and Handled each pay half of it (the pro's half comes off that job's payout and is shown on the
 *           work order before they accept). Paid in the weekly Stripe run once the job is past the 30-day
 *           make-it-right window.
 * UPDATED : 2026-10-28_0122 UTC — partner-v2: fixed tiers (25% one-time / 10% repeat / 15% account) of the job price,
 *           split 50/50 between the pro and Handled (was 10% of Handled's take); the standard referral ticket.
 */
import { BRAND } from "./brand.ts";
import { CARD_FEE } from "./pricing.ts";

export const PARTNER_TIERS = {
  one_time: { rate: 0.25, label: "One-time job", short: "25% of the first job", detail: "the referred customer's first job, when it's a one-time job" },
  repeat: { rate: 0.1, label: "Repeat or recurring", short: "10% of every repeat job for 12 months", detail: "every repeat or recurring job from the customer for 12 months" },
  account: { rate: 0.15, label: "Business / property account", short: "15% of every job for 12 months", detail: "every job on a referred business or property account for 12 months" },
} as const;
export type PartnerTier = keyof typeof PARTNER_TIERS;

export const PARTNER_PROGRAM = {
  proShare: 0.5,           // the pro pays half of the partner's earnings, Handled pays the other half
  months: 12,              // a referred customer pays their partner for this long
  holdDays: BRAND.guaranteeDays, // paid after the make-it-right window, so refunds come first
  minPayout: 25,           // smaller balances roll to the next weekly run (keeps Stripe fees sensible)
  cookieDays: 90,          // a click on a partner link counts for this long
  termsVersion: "partner-v2",
  /** Jobs booked before this keep the partner-v1 rule (10% of Handled's take, paid by Handled alone). */
  effectiveAt: "2026-10-28T00:00:00Z",
  /** partner-v1, for jobs booked before effectiveAt. */
  legacyPctOfTake: 0.1,
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

const cents = (n: number) => Math.round(n * 100);
const pct = (r: number) => `${+(r * 100).toFixed(1)}%`;
export const tierPct = (t: PartnerTier) => pct(PARTNER_TIERS[t].rate);

/**
 * Which tier a job pays at. A business / property account always pays the account rate; otherwise the customer's
 * first job pays the one-time rate when it's a one-time job, and everything after it (or any recurring visit) the
 * repeat rate.
 */
export function partnerTier(j: { business_account_id?: string | null; frequency?: string | null; plan_id?: string | null; firstJob: boolean }): PartnerTier {
  if (j.business_account_id) return "account";
  if (j.firstJob && (j.frequency ?? "once") === "once" && !j.plan_id) return "one_time";
  return "repeat";
}

/**
 * The partner's earnings on one job and who pays them.
 *   target  = tier rate × (price − refunds), rounded down to the cent
 *   fromPro = half of it, off the pro's payout (never more than the payout; 0 when the pro isn't on terms that include it)
 *   fromUs  = the other half, out of what Handled keeps — never more than our fee after the card fee, so a referred job
 *             can't lose us money. When our fee can't cover our half the partner gets less ("up to" the tier rate).
 */
export function partnerSplit(o: { price: number; payout: number; refunded?: number; tier: PartnerTier; proPays?: boolean }) {
  const rate = PARTNER_TIERS[o.tier].rate;
  const base = Math.max(0, cents(o.price) - cents(o.refunded ?? 0));
  const target = Math.floor(base * rate);
  const half = Math.floor(target * PARTNER_PROGRAM.proShare);
  const fromPro = o.proPays === false ? 0 : Math.min(half, Math.max(0, cents(o.payout)));
  const card = base > 0 ? Math.round(base * CARD_FEE.pct + CARD_FEE.fixed * 100) : 0;
  const room = Math.max(0, base - cents(o.payout) - card);
  const fromUs = Math.min(target - half, room);
  return { tier: o.tier, rate, target: target / 100, fromPro: fromPro / 100, fromUs: fromUs / 100, amount: (fromPro + fromUs) / 100 };
}
export type PartnerSplit = ReturnType<typeof partnerSplit>;

/** partner-v1 (jobs booked before PARTNER_PROGRAM.effectiveAt): what Handled keeps after the pro and refunds. */
export function partnerTake(o: { price: number; payout: number; refunded?: number }): number {
  return Math.max(0, cents(o.price) - cents(o.payout) - cents(o.refunded ?? 0)) / 100;
}

/** partner-v1: 10% of our take, rounded down to the cent, paid by Handled alone. */
export function partnerCommission(o: { price: number; payout: number; refunded?: number }): number {
  return Math.floor(cents(partnerTake(o)) * PARTNER_PROGRAM.legacyPctOfTake) / 100;
}

/** Was this job booked under partner-v1? */
export const partnerLegacyJob = (createdAt: string | Date) => new Date(createdAt).getTime() < new Date(PARTNER_PROGRAM.effectiveAt).getTime();

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

/** When a referral stops paying (12 months after it started). */
export function partnerExpiry(start: Date): Date {
  const d = new Date(start);
  d.setUTCMonth(d.getUTCMonth() + PARTNER_PROGRAM.months);
  return d;
}

// ─── The referral ticket ─────────────────────────────────────────────────────
// One standard form for every referral, from every partner: the same questions, a ticket number, and a status the
// partner can follow from "submitted" to "paid".

export const TICKET_JOB_TYPES = {
  one_time: { label: "One-time job", earns: `${tierPct("one_time")} of their first job, then ${tierPct("repeat")} of any repeat job for ${PARTNER_PROGRAM.months} months` },
  recurring: { label: "Recurring service (weekly, every 2 weeks, monthly…)", earns: `${tierPct("repeat")} of every visit for ${PARTNER_PROGRAM.months} months` },
  account: { label: "Business or property account (several jobs or properties)", earns: `${tierPct("account")} of every job on the account for ${PARTNER_PROGRAM.months} months` },
} as const;
export type TicketJobType = keyof typeof TICKET_JOB_TYPES;

export const TICKET_TIMING = {
  asap: "As soon as possible",
  week: "Within a week",
  month: "Within a month",
  date: "On a specific date",
  flexible: "Flexible / just wants a price",
} as const;
export type TicketTiming = keyof typeof TICKET_TIMING;

export const TICKET_CONTACT = { call: "Phone call", text: "Text", email: "Email" } as const;
export type TicketContact = keyof typeof TICKET_CONTACT;

export const TICKET_RELATIONSHIPS = {
  client: "My client (I'm their realtor, manager, contractor…)",
  tenant_owner: "Owner or tenant of a property I manage",
  friend: "Friend, family or neighbor",
  business: "A business I work with",
  other: "Other",
} as const;
export type TicketRelationship = keyof typeof TICKET_RELATIONSHIPS;

/** What staff set by hand; booked / completed / paid come from the customer's jobs and commissions. */
export const TICKET_STATUSES = {
  submitted: "Submitted",
  contacted: "We reached out",
  booked: "Booked",
  completed: "Job done",
  paid: "Paid",
  closed: "Closed",
} as const;
export type TicketStatus = keyof typeof TICKET_STATUSES;

/** A ticket number: "RT-" + 6 characters, no look-alike characters, e.g. "RT-7K2QMX". */
export function makeTicketNo(rand: () => number = Math.random): string {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += abc[Math.floor(rand() * abc.length)];
  return `RT-${s}`;
}

/** Where a ticket stands: paid > completed > booked come from money; otherwise what staff set. */
export function ticketStage(t: { status?: string | null; first_job_id?: string | null }, money: { completed?: number; paid?: number } = {}): TicketStatus {
  if (t.status === "closed" && !t.first_job_id) return "closed";
  if ((money.paid ?? 0) > 0) return "paid";
  if ((money.completed ?? 0) > 0) return "completed";
  if (t.first_job_id) return "booked";
  return t.status === "contacted" ? "contacted" : "submitted";
}

/** The earnings table, in the same words everywhere (sign-up page, partner page, Hub, emails, terms). */
export function partnerRateLines(): string[] {
  return (Object.keys(PARTNER_TIERS) as PartnerTier[]).map((t) => `${tierPct(t)} — ${PARTNER_TIERS[t].detail}`);
}

/** The partner terms shown at sign-up (plain English). */
export function partnerTerms(): string[] {
  const p = PARTNER_PROGRAM;
  return [
    `You earn a fixed share of the job price (what the customer pays, minus any refunds) on every completed job from a customer you refer: ${tierPct("one_time")} of their first job when it's a one-time job; ${tierPct("repeat")} of every repeat or recurring job for ${p.months} months from the referral; ${tierPct("account")} of every job on a business or property account you refer, for ${p.months} months. The rate is the same on every service.`,
    `Half of what you earn is paid by the pro who does the job and half by ${BRAND.name}. ${BRAND.name}'s half never exceeds what ${BRAND.name} keeps on the job after card fees, so on the rare job where our fee is too thin, you earn less than the full rate.`,
    `A customer counts as yours when they book through your link (within ${p.cookieDays} days of clicking it) or after you send them to us on a referral ticket from your partner page, and they are new to ${BRAND.name}. Each customer belongs to one partner: the first one.`,
    `Commissions are paid weekly through Stripe once the job is ${p.holdDays} days past completion (our make-it-right window). Balances under $${p.minPayout} carry over to the next week. Refunds and chargebacks reduce or cancel the commission on that job.`,
    "Referring yourself, your own household or your own business doesn't count. Only send a referral ticket for someone who has agreed to be contacted by us. No spam, fake reviews, or promises about price or service that we didn't make. Breaking these rules ends the partnership and any unpaid commissions.",
    `You're an independent referral partner, not an employee or agent of ${BRAND.name}. If we pay you $600 or more in a year, we'll need your tax details (collected by Stripe) and send you a 1099.`,
    "We may change these terms with 30 days' notice by email. Commissions already earned are paid under the terms in place when the job was booked.",
  ];
}
