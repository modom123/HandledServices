/*
 * FILE    : packages/core/src/partners.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0100 UTC
 * PURPOSE : Referral Partner Program rules, shared by web, app and Hub. Anyone (realtors, property managers,
 *           contractors, neighbors) can sign up, share their link or send us a customer, and earn:
 *             • 10% of Handled's take (price − pro payout − refunds) on every completed job from that customer,
 *             • for 12 months from the first referral,
 *             • paid in the weekly Stripe run once the job is past the 30-day make-it-right window.
 *           It comes out of our share, never the pro's pay, so a referred job can never lose money.
 * UPDATED : 2026-11-06_1638 UTC — Field Sales: the commission climbs a ladder from 10% to 45% of our take as the partner's
 *           lifetime profit generated for Handled grows (45% at $1,000,000), with a job-count fast track to 20%.
 *           Field Sales tickets: 3–4 photos + the customer's details → the customer gets a link to see the price and pay.
 */
import { BRAND } from "./brand.ts";
import { getService, missingMeasurements, type Answers } from "./services.ts";
import { photoRule } from "./intake.ts";

export const PARTNER_PROGRAM = {
  pctOfTake: 0.1,          // 10% of what Handled keeps on the job
  months: 12,              // every job from a referred customer pays for this long
  holdDays: BRAND.guaranteeDays, // paid after the make-it-right window, so refunds come first
  minPayout: 25,           // smaller balances roll to the next weekly run (keeps Stripe fees sensible)
  cookieDays: 90,          // a click on a partner link counts for this long
  termsVersion: "partner-v2",
} as const;

/**
 * The commission ladder (Field Sales + referrals). Every level is +1 point, from 10% (level 0) to 45% (level 35).
 * A level is reached by the partner's LIFETIME PROFIT GENERATED for Handled (our take on their completed jobs, after pro
 * pay and refunds), on the curve  threshold(n) = $1,000,000 × (n / 35)²  — quick early raises, 45% at $1M.
 * Fast track: every 10 completed jobs is also +1 point, up to 20% (so steady small-ticket sellers move up early, but only
 * profit takes anyone past 20%). The higher of the two counts. Levels never go down.
 */
export const PARTNER_LADDER = {
  baseRate: 0.10,
  topRate: 0.45,
  topProfit: 1_000_000,  // lifetime profit generated that reaches the top rate
  curve: 2,              // threshold(n) = topProfit × (n / levels)^curve
  jobsPerStep: 10,       // fast track: +1 point per this many completed jobs …
  jobsCapRate: 0.20,     // … up to this rate
} as const;
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

/** A partner's level and rate from their lifetime profit generated and completed jobs. */
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

/** Field Sales tickets: the rep's photos and the customer's details → the customer's own link to see the price and pay. */
export const SALES_TICKET = {
  minPhotos: 3,
  maxPhotos: 4,
  expiresDays: 30,      // an unbooked ticket lapses (the customer stays the rep's for the normal 12 months)
} as const;

/** What a ticket holds so the sale can close: the customer can pay from it without being asked anything again. */
export type TicketClose = {
  service_slug: string | null; answers: Answers; photos: number;
  customer_name: string; customer_email: string; customer_phone: string | null;
  address: string | null; city: string | null; state: string | null; zip: string | null;
  urgency: string | null; decision_maker: boolean;
};

/**
 * Close-ready check for a Field Sales ticket. Everything the booking needs to show a firm price and take payment:
 * the service, its required measurements, enough photos (3–4, or more if the service's photo rule needs it), a full
 * service address (on-site work), a mobile number, when they need it, and the person who decides and pays. [] = ready.
 */
export function ticketCloseCheck(t: TicketClose): string[] {
  const miss: string[] = [];
  const svc = t.service_slug ? getService(t.service_slug) : undefined;
  if (!svc) miss.push("the service");
  else {
    const m = missingMeasurements(svc.questions, t.answers);
    if (m.length) miss.push(m.map((q) => q.label.toLowerCase()).join(", "));
  }
  // on-site work: 3–4 photos. Remote services (websites, AI, formation, consulting) are sold without photos.
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

const cents = (n: number) => Math.round(n * 100);

/** What Handled keeps on a job after the pro's payout and any refunds (never below 0). */
export function partnerTake(o: { price: number; payout: number; refunded?: number }): number {
  return Math.max(0, cents(o.price) - cents(o.payout) - cents(o.refunded ?? 0)) / 100;
}

/** The partner's commission on a job: their ladder rate (10%–45%) of our take, rounded down to the cent. */
export function partnerCommission(o: { price: number; payout: number; refunded?: number }, rate: number = PARTNER_PROGRAM.pctOfTake): number {
  const r = Math.max(0, Math.min(PARTNER_LADDER.topRate, rate));
  return Math.floor(Math.round(cents(partnerTake(o)) * r * 1e6) / 1e6) / 100;
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
    `You earn a share of ${BRAND.name}'s profit on the job (the job price minus what the pro is paid and any refunds) on every completed job from a customer you bring us, for ${p.months} months from their first referral. Your share starts at ${PARTNER_LADDER.baseRate * 100}% and rises one point at a time to ${PARTNER_LADDER.topRate * 100}% as the lifetime profit you generate for ${BRAND.name} grows (${PARTNER_LADDER.topRate * 100}% at $${PARTNER_LADDER.topProfit.toLocaleString("en-US")}), or every ${PARTNER_LADDER.jobsPerStep} completed jobs up to ${PARTNER_LADDER.jobsCapRate * 100}%. Your rate is set when each job is completed and never goes down.`,
    `A customer counts as yours when they book through your link (within ${p.cookieDays} days of clicking it), after you send them to us from your partner page, or from a Field Sales ticket you write, and they are new to ${BRAND.name}. Each customer belongs to one partner: the first one.`,
    `Field Sales tickets: only photograph property with the owner's or manager's permission, only submit customers who asked to hear from us, and never take payment yourself. The customer sees the price and pays ${BRAND.name} directly; the job goes to our pros once it's paid.`,
    `Commissions are paid weekly through Stripe once the job is ${p.holdDays} days past completion (our make-it-right window). Balances under $${p.minPayout} carry over to the next week. Refunds and chargebacks reduce or cancel the commission on that job.`,
    "Referring yourself, your own household or your own business doesn't count. No spam, fake reviews, or promises about price or service that we didn't make. Breaking these rules ends the partnership and any unpaid commissions.",
    `You're an independent referral partner, not an employee or agent of ${BRAND.name}. If we pay you $600 or more in a year, we'll need your tax details (collected by Stripe) and send you a 1099.`,
    "We may change these terms with 30 days' notice by email. Commissions already earned are paid under the terms in place when the job was booked.",
  ];
}
