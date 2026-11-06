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
 * UPDATED : 2026-11-06_1730 UTC — partner-v3: two ways to earn. Referrals keep the partner-v2 tiers above. Direct sales
 *           (Field Sales: the partner closes the sale on a close-ready sales ticket) pay a LADDER: 10% of Handled's take,
 *           +1 point per level to 45% at $1,000,000 lifetime direct-sale profit (threshold(n) = $1M × (n/35)²), or +1
 *           point per 10 completed direct-sale jobs up to 20%; paid by Handled alone (no pro fee).
 */
import { BRAND } from "./brand.ts";
import { CARD_FEE } from "./pricing.ts";
import { getService, missingMeasurements, type Answers } from "./services.ts";
import { photoRule } from "./intake.ts";

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
  termsVersion: "partner-v3",
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
  sales_rep: "Field Sales partner (part-time / full-time)",
  other: "Someone else",
} as const;
export type PartnerKind = keyof typeof PARTNER_KINDS;

// ─── Direct sales (Field Sales): the commission ladder ───────────────────────

/**
 * Direct sales pay a ladder. Every level is +1 point, from 10% (level 0) to 45% (level 35) of Handled's take (job price
 * − pro payout − refunds). A level is reached by the partner's LIFETIME PROFIT GENERATED for Handled on jobs they sold,
 * on the curve threshold(n) = $1,000,000 × (n / 35)² — quick early raises, 45% at $1M. Fast track: every 10 completed
 * direct-sale jobs is also +1 point, up to 20%. The higher of the two counts. Levels never go down. Paid by Handled alone.
 * Both ways to earn build the level: direct-sale profit and jobs count 1.5×, referral profit and jobs 1× (ladderCredit).
 */
export const PARTNER_LADDER = {
  baseRate: 0.10,
  topRate: 0.45,
  topProfit: 1_000_000,  // lifetime profit generated that reaches the top rate
  curve: 2,              // threshold(n) = topProfit × (n / levels)^curve
  jobsPerStep: 10,       // fast track: +1 point per this many completed jobs …
  jobsCapRate: 0.20,     // … up to this rate
  directCredit: 1.5,     // level credit: a direct sale's profit (and job) counts 1.5× toward the next raise …
  referralCredit: 1,     // … a referral's counts 1× (referrals are still PAID at the partner-v2 tiers)
} as const;

/** Ladder credit: direct-sale profit and jobs weighted 1.5×, referral profit and jobs 1×. */
export function ladderCredit(o: { directProfit: number; referralProfit: number; directJobs: number; referralJobs: number }) {
  const P = PARTNER_LADDER;
  return {
    profit: Math.round((o.directProfit * P.directCredit + o.referralProfit * P.referralCredit) * 100) / 100,
    jobs: Math.floor(o.directJobs * P.directCredit + o.referralJobs * P.referralCredit),
  };
}
export const LADDER_LEVELS = Math.round((PARTNER_LADDER.topRate - PARTNER_LADDER.baseRate) * 100); // 35

/** Lifetime profit needed for level n (0…35), rounded to a friendly number. */
export function ladderThreshold(n: number): number {
  const L = Math.max(0, Math.min(LADDER_LEVELS, Math.floor(n)));
  const t = PARTNER_LADDER.topProfit * (L / LADDER_LEVELS) ** PARTNER_LADDER.curve;
  const step = t < 10_000 ? 100 : t < 100_000 ? 500 : 1000;
  return Math.round(t / step) * step;
}

const rateAt = (level: number) => Math.round((PARTNER_LADDER.baseRate + level / 100) * 100) / 100;

/** The whole ladder, for the partner page, the sign-up page and the Indeed post. */
export function ladderTable(): { level: number; rate: number; profit: number }[] {
  return Array.from({ length: LADDER_LEVELS + 1 }, (_, n) => ({ level: n, rate: rateAt(n), profit: ladderThreshold(n) }));
}

export type PartnerLevel = {
  level: number; rate: number;
  byProfit: number; byJobs: number;
  next: { level: number; rate: number; profit: number; profitToGo: number; jobsToGo: number | null } | null;
};

/** A partner's direct-sales level and rate from their lifetime direct-sale profit and completed direct-sale jobs. */
export function partnerLevel(lifetimeProfit: number, completedJobs = 0): PartnerLevel {
  const P = PARTNER_LADDER;
  let byProfit = 0;
  while (byProfit < LADDER_LEVELS && lifetimeProfit >= ladderThreshold(byProfit + 1)) byProfit++;
  const jobCap = Math.round((P.jobsCapRate - P.baseRate) * 100);
  const byJobs = Math.min(jobCap, Math.floor(Math.max(0, completedJobs) / P.jobsPerStep));
  const level = Math.max(byProfit, byJobs);
  const rate = rateAt(level);
  if (level >= LADDER_LEVELS) return { level, rate, byProfit, byJobs, next: null };
  const n = level + 1;
  const profit = ladderThreshold(n);
  const jobsToGo = n <= jobCap ? n * P.jobsPerStep - completedJobs : null;
  return { level, rate, byProfit, byJobs, next: { level: n, rate: rateAt(n), profit, profitToGo: Math.max(0, Math.round((profit - lifetimeProfit) * 100) / 100), jobsToGo } };
}

/** A direct sale's commission: the ladder rate (10%–45%) of our take, rounded down to the cent. Paid by Handled alone. */
export function partnerSaleCommission(o: { price: number; payout: number; refunded?: number }, rate: number): number {
  const r = Math.max(0, Math.min(PARTNER_LADDER.topRate, rate));
  const take = Math.max(0, Math.round(o.price * 100) - Math.round(o.payout * 100) - Math.round((o.refunded ?? 0) * 100));
  return Math.floor(Math.round(take * r * 1e6) / 1e6) / 100;
}

/** Sales tickets: what the partner sells → the customer's own link to pay (or pay on the partner's phone). */
export const SALES_TICKET = {
  minPhotos: 3,
  maxPhotos: 4,
  expiresDays: 30,      // an unbooked ticket lapses (the customer stays the partner's for the normal 12 months)
} as const;

/** What a sales ticket holds so the sale can close: the customer can pay from it without being asked anything again. */
export type TicketClose = {
  service_slug: string | null; answers: Answers; photos: number;
  customer_name: string; customer_email: string; customer_phone: string | null;
  address: string | null; city: string | null; state: string | null; zip: string | null;
  urgency: string | null; decision_maker: boolean;
};

/**
 * Close-ready check for a sales ticket: the service, its required measurements, 3–4 photos for on-site work (none for
 * remote services), a full service address (on-site work), a mobile number, when they need it, and the person who
 * decides and pays. [] = ready.
 */
export function ticketCloseCheck(t: TicketClose): string[] {
  const miss: string[] = [];
  const svc = t.service_slug ? getService(t.service_slug) : undefined;
  if (!svc) miss.push("the service");
  else {
    const m = missingMeasurements(svc.questions, t.answers);
    if (m.length) miss.push(m.map((q) => q.label.toLowerCase()).join(", "));
  }
  const need = svc?.remote ? 0 : Math.max(SALES_TICKET.minPhotos, svc ? Math.min(SALES_TICKET.maxPhotos, photoRule(svc.slug).min) : 0);
  if (t.photos > SALES_TICKET.maxPhotos) miss.push(`no more than ${SALES_TICKET.maxPhotos} photos`);
  if (t.photos < need) miss.push(`${need - t.photos} more photo${need - t.photos > 1 ? "s" : ""}`);
  if (!(t.customer_name ?? "").trim() || !/\S+@\S+\.\S+/.test(t.customer_email ?? "")) miss.push("the customer's name and email");
  if ((t.customer_phone ?? "").replace(/\D/g, "").length < 10) miss.push("the customer's mobile number");
  if (!svc?.remote && (!(t.address ?? "").trim() || !(t.city ?? "").trim() || !/^[A-Za-z]{2}$/.test(t.state ?? "") || !/^\d{5}$/.test(t.zip ?? ""))) miss.push("the full service address");
  if (!svc?.leadDays && !t.urgency) miss.push("when they need it");
  if (!t.decision_maker) miss.push("confirmation you spoke with the person who decides and pays");
  return miss;
}

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
    `Direct sales: when you sell a customer yourself on a sales ticket (they pay ${BRAND.name} directly, on your phone or from our text), you earn a share of ${BRAND.name}'s profit on the job (the price minus what the pro is paid and any refunds) instead, on every completed job from that customer for ${p.months} months, paid by ${BRAND.name} alone. Your share starts at ${PARTNER_LADDER.baseRate * 100}% and rises one point at a time to ${PARTNER_LADDER.topRate * 100}% as the lifetime profit from your direct sales grows (${PARTNER_LADDER.topRate * 100}% at $${PARTNER_LADDER.topProfit.toLocaleString("en-US")}), or every ${PARTNER_LADDER.jobsPerStep} completed direct-sale jobs up to ${PARTNER_LADDER.jobsCapRate * 100}%. Your rate is set when each job is completed and never goes down.`,
    `A customer counts as yours when they book through your link (within ${p.cookieDays} days of clicking it), type your partner code when they pay, or after you send them to us on a referral ticket or a sales ticket from your partner page, and they are new to ${BRAND.name}. Each customer belongs to one partner: the first one.`,
    `Sales tickets: only photograph property with the owner's or manager's permission, only submit customers who asked to hear from us, and never take payment yourself. Once a job is paid, it goes to our pros.`,
    `Commissions are paid weekly through Stripe once the job is ${p.holdDays} days past completion (our make-it-right window). Balances under $${p.minPayout} carry over to the next week. Refunds and chargebacks reduce or cancel the commission on that job.`,
    "Referring yourself, your own household or your own business doesn't count. Only send a referral ticket for someone who has agreed to be contacted by us. No spam, fake reviews, or promises about price or service that we didn't make. Breaking these rules ends the partnership and any unpaid commissions.",
    `You're an independent referral partner, not an employee or agent of ${BRAND.name}. If we pay you $600 or more in a year, we'll need your tax details (collected by Stripe) and send you a 1099.`,
    "We may change these terms with 30 days' notice by email. Commissions already earned are paid under the terms in place when the job was booked.",
  ];
}
