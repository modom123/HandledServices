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
 * UPDATED : 2026-11-06_1800 UTC — partner-v4: referrals pay ONE rate on every referred job, 15% of the job price rising to
 *           30% (REFERRAL_LADDER: 30% at $1M of level credit, threshold(n) = $1M × (n/15)²), still half from the pro. The
 *           rate is locked on the job when it's booked (jobs.partner_rate) so the pro sees their half before accepting.
 *           The partner-v2 tiers (PARTNER_TIERS) stay only for jobs booked before this, which have no partner_rate.
 * UPDATED : 2026-11-07_1500 UTC — Post & earn: someone who posts a project on /post (tick-box, checked by default) joins
 *           the Partner Program and gets FIRST_PROJECT_REWARD back on their OWN first project — 10% of the price, up to
 *           $250, paid by Handled alone (referral_customers.source 'self', partner_commissions.tier 'self'). The one
 *           exception to "referring yourself doesn't count".
 * UPDATED : 2026-11-18_0125 UTC — the Handled Sales Force term: a member's direct sale pays the higher of the v7 rate (+ points) and
 *           their rank share, plus book share, team shares and bonuses (only ever adds to the program's pay).
 * UPDATED : 2026-11-10_0400 UTC — partner-v5: lead pay — $10 per lead as a draw against that lead's commission, unlocked
 *           after 10 leads and one paid-out sale (SALES_DRAW, drawUnlocked, drawRecovery).
 * UPDATED : 2026-11-17_2000 UTC — partner-v7: ONE program (owner) on the old Field Sales formula, starting at 15%. Every
 *           commission is a share of HANDLED'S PROFIT on the job (price − pro pay − refunds), paid by Handled alone (the pro
 *           keeps full pay). Rate: 15% → 45% (REFERRAL_LADDER), +1 point per level, level n at $1,000,000 × (n/30)² of level
 *           credit = profit made for Handled (direct sales 1.5×, referrals 1×). A direct sale pays the rate + 5 points
 *           (PARTNER_LADDER, 20% → 50%). Locked on the job at booking; a v7 job = partner_rate set and partner_tier null.
 *           Existing partners keep partner-v4 (15%–30% of the price, shared with the pro; REFERRAL_LADDER_V4) on referrals
 *           until they sign v7 or PARTNER_PROGRAM.v7AllAt (30 days' notice). Never more than Handled keeps after card fees.
 * UPDATED : 2026-11-17_2100 UTC — partner-v6: the Referral Partner Agreement (apps/web/lib/contracts/partner.ts), signed at sign-up or on
 *           the partner page; referral jobs only go to pros on the current pro agreement, so the pro's half is always paid.
 * UPDATED : 2026-11-24_1700 UTC — rankSaleRate(rank): the one rate a Sales Force rank pays on a sale (for the site's single chart).
 */
import { BRAND } from "./brand.ts";
import { SALES_RANKS } from "./sales-force.ts";
import { CARD_FEE } from "./pricing.ts";
import { getService, missingMeasurements, type Answers } from "./services.ts";
import { photoRule } from "./intake.ts";

/** partner-v2 tiers: only for referred jobs booked before partner-v4 (no jobs.partner_rate). New jobs: REFERRAL_LADDER. */
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
  termsVersion: "partner-v7", // v7: one program — 15% → 45% of Handled's profit ($1M × (n/30)²), direct sales +5 points and 1.5× credit; v6: the signable agreement
  /** partner-v7 applies to every partner's jobs booked from here (30 days' notice); earlier for anyone who signs v7. */
  v7AllAt: "2026-12-18T05:00:00Z",
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

// ─── Post & earn: the first-project reward ───────────────────────────────────

/**
 * Post your project → you're a partner, and your own first project pays you back: 10% of the job price (minus refunds),
 * up to $250, paid by Handled alone (the pro pays nothing). Only the poster's first job, only for someone new to Handled.
 * Like every commission it never exceeds what Handled keeps on the job after card fees, and it's paid in the weekly run
 * once the job is past the make-it-right window.
 */
export const FIRST_PROJECT_REWARD = { rate: 0.10, cap: 250 } as const;

/** The first-project reward on one job, in dollars (rounded down to the cent). Pass payout to apply the our-fee limit. */
export function firstProjectReward(o: { price: number; payout?: number; refunded?: number }): number {
  const c = (n: number) => Math.round(n * 100);
  const base = Math.max(0, c(o.price) - c(o.refunded ?? 0));
  const target = Math.min(Math.floor(base * FIRST_PROJECT_REWARD.rate), c(FIRST_PROJECT_REWARD.cap));
  if (o.payout == null) return target / 100;
  const card = base > 0 ? Math.round(base * CARD_FEE.pct + CARD_FEE.fixed * 100) : 0;
  const room = Math.max(0, base - c(o.payout) - card);
  return Math.min(target, room) / 100;
}

/** "10% back, up to $250" — the same words everywhere. */
export const firstProjectLine = (es = false) =>
  es ? `${Math.round(FIRST_PROJECT_REWARD.rate * 100)}% de reembolso, hasta $${FIRST_PROJECT_REWARD.cap}`
     : `${Math.round(FIRST_PROJECT_REWARD.rate * 100)}% back, up to $${FIRST_PROJECT_REWARD.cap}`;

// ─── Direct sales (Field Sales): the commission ladder ───────────────────────

/**
 * partner-v7: the DIRECT-SALE rate — the program rate + 5 points (20% → 50% of Handled's profit), on the same levels.
 */
export const PARTNER_LADDER = {
  baseRate: 0.20,
  topRate: 0.50,
  topProfit: 1_000_000,  // level credit (profit made for Handled, weighted) that reaches the top rate
  curve: 2,              // threshold(n) = topProfit × (n / levels)^curve — the old Field Sales formula
  jobsPerStep: 10,
  jobsCapRate: 0.20,     // = baseRate: no job-count fast track
  directCredit: 1.5,     // a direct sale's profit counts 1.5× toward the next raise …
  referralCredit: 1,     // … a referral's 1×
} as const;

/** Ladder credit: profit made for Handled — direct sales weighted 1.5×, referrals 1× (jobs counted the same way). */
export function ladderCredit(o: { directProfit: number; referralProfit: number; directJobs: number; referralJobs: number }) {
  const P = PARTNER_LADDER;
  return {
    profit: Math.round((o.directProfit * P.directCredit + o.referralProfit * P.referralCredit) * 100) / 100,
    jobs: Math.floor(o.directJobs * P.directCredit + o.referralJobs * P.referralCredit),
  };
}
/**
 * partner-v7: the program rate for everyone — 15% of Handled's profit on the job to start, +1 point per level to 45% at
 * $1,000,000 of level credit: threshold(n) = $1M × (n/30)² (the old Field Sales formula, starting at 15%). Paid by
 * Handled alone. A direct sale pays this + DIRECT_BONUS (PARTNER_LADDER).
 */
export const REFERRAL_LADDER = {
  baseRate: 0.15,
  topRate: 0.45,
  topProfit: 1_000_000,
  curve: 2,
  jobsPerStep: 10,
  jobsCapRate: 0.15, // = baseRate: no job-count fast track
} as const;

/** partner-v4 (existing partners until they sign v7 or v7AllAt): referrals 15% → 30% of the JOB PRICE, half from the pro. */
export const REFERRAL_LADDER_V4 = {
  baseRate: 0.15,
  topRate: 0.30,
  topProfit: 1_000_000,
  curve: 2,
  jobsPerStep: 10,
  jobsCapRate: 0.20,
} as const;

/** A direct sale pays the program rate + this (both on Handled's profit, paid by Handled). */
export const DIRECT_BONUS = 0.05;

/**
 * partner-v7 commission on one job: rate × Handled's profit (price − pro pay − refunds), rounded down to the cent, paid
 * by Handled alone — never more than Handled keeps after the card fee.
 */
export function programCommission(o: { price: number; payout: number; refunded?: number }, rate: number): number {
  const r = Math.max(0, Math.min(PARTNER_LADDER.topRate, rate));
  const base = Math.max(0, cents(o.price) - cents(o.refunded ?? 0));
  const take = Math.max(0, base - cents(o.payout));
  const card = base > 0 ? Math.round(base * CARD_FEE.pct + CARD_FEE.fixed * 100) : 0;
  return Math.max(0, Math.min(Math.floor(Math.round(take * r * 1e6) / 1e6), take - card)) / 100;
}

/** A v7 job: its rate was locked as a share of Handled's profit (partner_rate set, no partner-v2/v4 tier). */
export const programJob = (j: { partner_id?: string | null; partner_rate?: number | string | null; partner_tier?: string | null }) =>
  Boolean(j.partner_id && j.partner_rate != null && !j.partner_tier);

export type Ladder = { baseRate: number; topRate: number; topProfit: number; curve: number; jobsPerStep: number; jobsCapRate: number };
/** How many +1-point levels a ladder has (sales: 35, referrals: 15). */
export const ladderLevels = (L: Ladder) => Math.round((L.topRate - L.baseRate) * 100);
export const LADDER_LEVELS = ladderLevels(PARTNER_LADDER); // 35

/** Level credit needed for level n of a ladder, rounded to a friendly number. */
export function ladderThreshold(n: number, Ld: Ladder = PARTNER_LADDER): number {
  const N = ladderLevels(Ld);
  const L = Math.max(0, Math.min(N, Math.floor(n)));
  const t = Ld.topProfit * (L / N) ** Ld.curve;
  const step = t < 10_000 ? 100 : t < 100_000 ? 500 : 1000;
  return Math.round(t / step) * step;
}

const rateAt = (level: number, Ld: Ladder = PARTNER_LADDER) => Math.round((Ld.baseRate + level / 100) * 100) / 100;

/** The whole ladder, for the partner page, the sign-up page and the Indeed post. */
export function ladderTable(Ld: Ladder = PARTNER_LADDER): { level: number; rate: number; profit: number }[] {
  return Array.from({ length: ladderLevels(Ld) + 1 }, (_, n) => ({ level: n, rate: rateAt(n, Ld), profit: ladderThreshold(n, Ld) }));
}

/** "15%–30%" — the referral range, in the same words everywhere. */
export const referralRange = () => `${Math.round(REFERRAL_LADDER.baseRate * 100)}%–${Math.round(REFERRAL_LADDER.topRate * 100)}%`;

export type PartnerLevel = {
  level: number; rate: number;
  byProfit: number; byJobs: number;
  next: { level: number; rate: number; profit: number; profitToGo: number; jobsToGo: number | null } | null;
};

/**
 * What a Sales Force rank really pays on a sale (website wording, 2026-11-24): a direct sale pays the higher of the rank's
 * share and the ladder rate + 5 points; reaching a rank's profit target (direct sales count 1.5×) puts you at least at
 * this ladder level. One number per rank, so the site shows a single chart. Leaders' own sales are at least 20%.
 */
export function rankSaleRate(rank: keyof typeof SALES_RANKS): number {
  const r = SALES_RANKS[rank];
  const ladder = partnerLevel((r.requires.profit ?? 0) * PARTNER_LADDER.directCredit, 0, REFERRAL_LADDER).rate + DIRECT_BONUS;
  return Math.round(Math.max(r.sellerShare, ladder) * 100) / 100;
}

/** A partner's direct-sales level and rate from their lifetime direct-sale profit and completed direct-sale jobs. */
export function partnerLevel(lifetimeProfit: number, completedJobs = 0, P: Ladder = PARTNER_LADDER): PartnerLevel {
  const N = ladderLevels(P);
  let byProfit = 0;
  while (byProfit < N && lifetimeProfit >= ladderThreshold(byProfit + 1, P)) byProfit++;
  const jobCap = Math.round((P.jobsCapRate - P.baseRate) * 100);
  const byJobs = Math.min(jobCap, Math.floor(Math.max(0, completedJobs) / P.jobsPerStep));
  const level = Math.max(byProfit, byJobs);
  const rate = rateAt(level, P);
  if (level >= N) return { level, rate, byProfit, byJobs, next: null };
  const n = level + 1;
  const profit = ladderThreshold(n, P);
  const jobsToGo = n <= jobCap ? n * P.jobsPerStep - completedJobs : null;
  return { level, rate, byProfit, byJobs, next: { level: n, rate: rateAt(n, P), profit, profitToGo: Math.max(0, Math.round((profit - lifetimeProfit) * 100) / 100), jobsToGo } };
}

/** Field Sales before v7: the rate × Handled's take (price − pro pay − refunds), rounded down. Paid by Handled alone. */
export function partnerSaleCommission(o: { price: number; payout: number; refunded?: number }, rate: number): number {
  const r = Math.max(0, Math.min(PARTNER_LADDER.topRate, rate));
  const take = Math.max(0, Math.round(o.price * 100) - Math.round(o.payout * 100) - Math.round((o.refunded ?? 0) * 100));
  return Math.floor(Math.round(take * r * 1e6) / 1e6) / 100;
}

/**
 * Lead pay (a draw): $10 for every lead — every close-ready sales ticket for a new customer — paid weekly, as an advance
 * against that lead's commission. It UNLOCKS only once the partner has written 10 leads AND at least one of their sales
 * has closed and been paid out; until then it builds up, and the whole balance is paid on the next weekly run after
 * unlocking. When a lead's job pays a commission, its $10 is taken back out of that commission. A lead that never closes
 * keeps its $10. At most 25 leads a week earn lead pay (abuse guard); admins can void a fake lead's pay.
 */
export const SALES_DRAW = { perLead: 10, unlockLeads: 10, unlockPaidSales: 1, weeklyCap: 25 } as const;
/** Is the partner's lead pay unlocked? */
export function drawUnlocked(o: { leads: number; paidSales: number }): boolean {
  return o.leads >= SALES_DRAW.unlockLeads && o.paidSales >= SALES_DRAW.unlockPaidSales;
}
/** How much of a commission repays its lead's draw: the draw still outstanding, never more than the commission. */
export function drawRecovery(o: { commission: number; drawOutstanding: number }): number {
  return Math.max(0, Math.min(Math.round(o.commission * 100), Math.round(o.drawOutstanding * 100))) / 100;
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
 *   target  = rate × (price − refunds), rounded down to the cent — the partner's locked referral rate (partner-v4), or the
 *             tier rate for jobs booked before it
 *   fromPro = half of it, off the pro's payout (never more than the payout; 0 when the pro isn't on terms that include it)
 *   fromUs  = the other half, out of what Handled keeps — never more than our fee after the card fee, so a referred job
 *             can't lose us money. When our fee can't cover our half the partner gets less ("up to" the tier rate).
 */
export function partnerSplit(o: { price: number; payout: number; refunded?: number; tier: PartnerTier; proPays?: boolean; rate?: number | null; bonus?: number; handledPays?: boolean }) {
  // partner-v4: the referral rate locked on the job (15%–30%); partner-v2 jobs (no locked rate): the tier rate
  const rate = o.rate != null && Number(o.rate) > 0 ? Math.min(REFERRAL_LADDER_V4.topRate, Number(o.rate)) : PARTNER_TIERS[o.tier].rate;
  const base = Math.max(0, cents(o.price) - cents(o.refunded ?? 0));
  // partner-v7: a direct sale is the ladder rate + bonus points, paid by Handled alone (handledPays); a referral is shared
  const bonus = Math.max(0, Math.min(0.2, Number(o.bonus ?? 0)));
  const target = Math.floor(base * (rate + bonus));
  const half = o.handledPays ? 0 : Math.floor(target * PARTNER_PROGRAM.proShare);
  const fromPro = o.proPays === false || o.handledPays ? 0 : Math.min(half, Math.max(0, cents(o.payout)));
  const card = base > 0 ? Math.round(base * CARD_FEE.pct + CARD_FEE.fixed * 100) : 0;
  const room = Math.max(0, base - cents(o.payout) - card);
  const fromUs = Math.min(target - half, room);
  return { tier: o.tier, rate: Math.round((rate + bonus) * 10000) / 10000, target: target / 100, fromPro: fromPro / 100, fromUs: fromUs / 100, amount: (fromPro + fromUs) / 100 };
}
export type PartnerSplit = ReturnType<typeof partnerSplit>;

/**
 * A referred job (partner-v4+: the referral rate is locked on the job) can only go to a pro who signed the pro agreement
 * that makes them pay half the partner's commission — so partners always get the full rate (owner, 2026-11-17).
 * Direct sales, Post & earn and jobs booked before a rate was locked are paid by Handled alone and need no pro term.
 */
export function proCanTakeReferredJob(job: { partner_id?: string | null; partner_rate?: number | string | null; partner_sale?: boolean | null; partner_tier?: string | null }, agreementVersion: string | null | undefined, current: string): boolean {
  if (!job.partner_id || job.partner_sale || job.partner_rate == null || !(job as { partner_tier?: string | null }).partner_tier) return true; // v7 jobs and direct sales: Handled pays alone
  return String(agreementVersion ?? "") >= current;
}

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
  one_time: { label: "One-time job", earns: `your referral rate (${referralRange()} of our profit on the job) on this job and any repeat job for ${PARTNER_PROGRAM.months} months` },
  recurring: { label: "Recurring service (weekly, every 2 weeks, monthly…)", earns: `your referral rate (${referralRange()} of our profit on the job) on every visit for ${PARTNER_PROGRAM.months} months` },
  account: { label: "Business or property account (several jobs or properties)", earns: `your referral rate (${referralRange()} of our profit on the job) on every job on the account for ${PARTNER_PROGRAM.months} months` },
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
  const R = REFERRAL_LADDER;
  return [
    `${Math.round(R.baseRate * 100)}% of ${BRAND.name}'s profit on every job you refer, ${Math.round((R.baseRate + DIRECT_BONUS) * 100)}% on every job you sell yourself — the same on every service`,
    `rising one point at a time to ${Math.round(R.topRate * 100)}% / ${Math.round((R.topRate + DIRECT_BONUS) * 100)}% as the profit you make ${BRAND.name} grows (top rate at $${R.topProfit.toLocaleString("en-US")}; direct sales count ${PARTNER_LADDER.directCredit}×)`,
    `locked on each job when it's booked, for every job from the customer for ${PARTNER_PROGRAM.months} months`,
  ];
}

/** The partner terms shown at sign-up (plain English). */
export function partnerTerms(): string[] {
  const p = PARTNER_PROGRAM, R = REFERRAL_LADDER, b = Math.round(DIRECT_BONUS * 100);
  return [
    `One program, two ways to earn. Refer a customer and you earn your rate on every completed job from them for ${p.months} months. Sell it yourself on a sales ticket (the customer pays ${BRAND.name} directly) and you earn your rate + ${b} points. Your rate is a share of ${BRAND.name}'s profit on the job — the price the customer pays minus what the pro is paid and any refunds — the same on every service.`,
    `Everyone starts at ${Math.round(R.baseRate * 100)}% (${Math.round((R.baseRate + DIRECT_BONUS) * 100)}% on direct sales) and moves up one point at a time to ${Math.round(R.topRate * 100)}% (${Math.round((R.topRate + DIRECT_BONUS) * 100)}%) as the profit your completed jobs make ${BRAND.name} grows, with direct sales counting ${PARTNER_LADDER.directCredit}× and referrals ${PARTNER_LADDER.referralCredit}×: level n comes at $1,000,000 × (n ÷ ${ladderLevels(R)})², so the top rate comes at $${R.topProfit.toLocaleString("en-US")} of profit. Each job keeps the rate you had when it was booked.`,
    `${BRAND.name} pays your commission in full; the pro's pay is never reduced. It never exceeds what ${BRAND.name} keeps on the job after card fees.`,
    `The Handled Sales Force (optional, for direct sales): members hold a title from Associate Account Executive to VP of Sales, earned from their totals since day one and never lost. A member's direct sale pays the higher of the rate above (+ ${b} points) and their rank's share of ${BRAND.name}'s profit (${Math.round(SALES_RANKS.associate.sellerShare * 100)}% to ${Math.round(SALES_RANKS.vp.sellerShare * 100)}%), plus a smaller book share on their customers after ${p.months} months, team shares for leaders who keep selling, $25 per walkthrough held, a first-sale bonus and promotion bonuses (details at handledsvc.com/careers/sales). Sales Force pay only adds to what this program pays.`,
    `A customer counts as yours when they book through your link (within ${p.cookieDays} days of clicking it), type your partner code when they pay, or after you send them to us on a referral ticket or a sales ticket from your partner page, and they are new to ${BRAND.name}. Each customer belongs to one partner: the first one.`,
    `Lead pay: you earn $${SALES_DRAW.perLead} for every lead (a complete sales ticket for a new customer), paid weekly, up to ${SALES_DRAW.weeklyCap} leads a week. It's an advance (a draw) against that lead's commission: when the lead's job pays you a commission, the $${SALES_DRAW.perLead} is taken back out of it; if the lead never books, you keep it. Lead pay starts once you've written ${SALES_DRAW.unlockLeads} leads and at least ${SALES_DRAW.unlockPaidSales} of your sales has closed and been paid out; what you built up before then is paid on the next weekly payout. Fake or duplicate leads earn nothing and can end the partnership.`,
    `Sales tickets: only photograph property with the owner's or manager's permission, only submit customers who asked to hear from us, and never take payment yourself. Once a job is paid, it goes to our pros.`,
    `Commissions are paid weekly through Stripe once the job is ${p.holdDays} days past completion (our make-it-right window). Balances under $${p.minPayout} carry over to the next week. Refunds and chargebacks reduce or cancel the commission on that job.`,
    `Referring yourself, your own household or your own business doesn't count, with one exception: when you post your own project on our Post your project page and join there, your own first project earns ${firstProjectLine()} (${Math.round(FIRST_PROJECT_REWARD.rate * 100)}% of the price minus refunds, paid by ${BRAND.name} alone and never more than ${BRAND.name} keeps on the job after card fees), once, if you're new to ${BRAND.name}. Only send a referral ticket for someone who has agreed to be contacted by us. No spam, fake reviews, or promises about price or service that we didn't make. Breaking these rules ends the partnership and any unpaid commissions.`,
    `You're an independent referral partner, not an employee or agent of ${BRAND.name}. If we pay you $600 or more in a year, we'll need your tax details (collected by Stripe) and send you a 1099.`,
    "We may change these terms with 30 days' notice by email. Commissions already earned are paid under the terms in place when the job was booked.",
  ];
}
