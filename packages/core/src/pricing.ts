/*
 * FILE    : packages/core/src/pricing.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-01_1830 UTC — splitJob(): one place that splits every price between the
 *           subcontractor and us. Our take is always 15–35% of the job (TAKE_MIN/MAX),
 *           payouts round down (in our favor), card fees are estimated so the hub shows
 *           net per job. Enforced again in the database (jobs_take_rate_band).
 * PURPOSE : Deterministic instant-quote engine. Produces the price range shown to the
 *           customer, the subcontractor payout and the platform margin. The AI quote
 *           (apps/web/lib/ai/quote.ts) may adjust inside guardrails but never below the
 *           service minimum or outside ±40% of this baseline.
 */

import { getService, type Answers, type LineItem } from "./services.ts";
import type { CustomerType, Frequency } from "./types.ts";

export const RECURRING_DISCOUNT: Record<Frequency, number> = {
  once: 0,
  weekly: 0.2,
  biweekly: 0.15,
  monthly: 0.1,
  quarterly: 0.05,
};

/** Bookings that start within this many hours get the rush surcharge. */
export const RUSH_HOURS = 48;
export const RUSH_SURCHARGE = 0.15;
/** Our take on every job: never below 15%, never above 35% of the price. */
export const TAKE_MIN = 0.15;
export const TAKE_MAX = 0.35;
/** Card processing estimate (Stripe US standard). Big tickets should use ACH instead. */
export const CARD_FEE = { pct: 0.029, fixed: 0.3 };

export interface JobSplit {
  price: number;
  /** What the subcontractor is paid. */
  payout: number;
  /** What we keep before processing fees. */
  take: number;
  takeRate: number;
  cardFee: number;
  /** What we keep after card fees. */
  net: number;
}

/**
 * Split a job price between the subcontractor and us. The payout share comes from the
 * service, clamped so our take is always within TAKE_MIN–TAKE_MAX, and the payout rounds
 * DOWN to the dollar so rounding can never cost us money.
 */
export function splitJob(price: number, slug: string): JobSplit {
  const svc = getService(slug);
  const share = Math.min(1 - TAKE_MIN, Math.max(1 - TAKE_MAX, svc?.payoutShare ?? 1 - TAKE_MIN));
  const payout = price > 0 ? Math.floor(price * share) : 0;
  const take = Math.round((price - payout) * 100) / 100;
  const cardFee = price > 0 ? Math.round((price * CARD_FEE.pct + CARD_FEE.fixed) * 100) / 100 : 0;
  return { price, payout, take, takeRate: price > 0 ? take / price : 0, cardFee, net: Math.round((take - cardFee) * 100) / 100 };
}

/** Guardrail on AI adjustments relative to the deterministic baseline. */
export const AI_MAX_ADJUST = 0.4;

export interface EstimateInput {
  slug: string;
  answers: Answers;
  frequency?: Frequency;
  customerType?: CustomerType;
  rush?: boolean;
}

export interface Estimate {
  slug: string;
  items: LineItem[];
  /** Point price per visit after discounts/surcharges. */
  point: number;
  low: number;
  high: number;
  hours: number;
  siteVisit: boolean;
  discount: number;
  payout: number;
  margin: number;
  payoutShare: number;
}

export const roundTo = (v: number, step = 5) => Math.round(v / step) * step;

export function estimate(input: EstimateInput): Estimate {
  const service = getService(input.slug);
  if (!service) throw new Error(`Unknown service: ${input.slug}`);
  const freq: Frequency = service.frequencies.includes(input.frequency ?? "once") ? input.frequency ?? "once" : "once";
  const { items, base, hours } = service.price(input.answers);
  const lines = [...items];
  let point = Math.max(base, service.minimum);
  if (point > base) lines.push({ label: "Service minimum", amount: point - base });

  const discount = RECURRING_DISCOUNT[freq];
  if (discount) {
    const d = Math.round(point * discount);
    lines.push({ label: `${freq} plan discount`, amount: -d });
    point -= d;
  }
  if (input.rush && !service.siteVisit) {
    const r = Math.round(point * RUSH_SURCHARGE);
    lines.push({ label: "Within-48h priority", amount: r });
    point += r;
  }
  point = Math.max(point, Math.round(service.minimum * (1 - discount)));

  const step = point >= 5000 ? 250 : point >= 1000 ? 25 : 5;
  // exact-price services (spread [1,1]) quote the exact amount — never a rounded "range"
  const exact = service.spread[0] === 1 && service.spread[1] === 1;
  const low = exact ? Math.round(point) : roundTo(point * service.spread[0], step);
  const high = exact ? Math.round(point) : roundTo(point * service.spread[1], step);
  const { payout } = splitJob(Math.round(point), service.slug);
  return {
    slug: service.slug,
    items: lines,
    point: Math.round(point),
    low: Math.max(low, Math.round(service.minimum * (1 - discount))),
    high,
    hours: Math.round(hours * 10) / 10,
    siteVisit: service.siteVisit,
    discount,
    payout,
    margin: Math.round(point) - payout,
    payoutShare: service.payoutShare,
  };
}

/** Clamp an AI-proposed price to the guardrails around the baseline. */
export function clampAiPrice(baseline: Estimate, proposed: number): number {
  const svc = getService(baseline.slug)!;
  const lo = Math.max(svc.minimum * (1 - baseline.discount), baseline.point * (1 - AI_MAX_ADJUST));
  const hi = baseline.point * (1 + AI_MAX_ADJUST);
  return Math.round(Math.min(hi, Math.max(lo, proposed)));
}

export function isRush(date: string | null | undefined, now = new Date()): boolean {
  if (!date) return false;
  const ms = new Date(`${date}T12:00:00`).getTime() - now.getTime();
  return ms < RUSH_HOURS * 3600 * 1000;
}

export const money = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const moneyRange = (lo: number, hi: number) => (lo === hi ? money(lo) : `${money(lo)} – ${money(hi)}`);

/**
 * Who covers a refund. Upfront payment means the customer has already paid; making it
 * right never pushes the job below $0 for us:
 *  - shared (default): the refund comes out of the pro's payout and our take in the same
 *    proportion as the original split, so our take % is unchanged
 *  - pro at fault: the pro's payout absorbs the refund first; we only cover what's left
 *  - protectPro (Pay protection): not the pro's fault → our take absorbs it first
 * The refund can't exceed what the customer paid minus earlier refunds.
 */
export function refundSplit(opts: { paid: number; alreadyRefunded: number; payout: number; refund: number; proAtFault?: boolean; protectPro?: boolean }) {
  const refundable = Math.max(0, opts.paid - opts.alreadyRefunded);
  const refund = Math.round(Math.min(Math.max(0, opts.refund), refundable) * 100) / 100;
  const ratio = opts.paid > 0 ? opts.payout / opts.paid : 0;
  // Pay protection: not the pro's fault → our remaining take absorbs it first; only what our
  // take can't cover comes from the payout, so the job still never goes below $0 for us.
  const ourLeft = Math.max(0, Math.round((refundable - opts.payout) * 100) / 100);
  const fromPro = opts.proAtFault
    ? Math.min(refund, opts.payout)
    : opts.protectPro
      ? Math.min(opts.payout, Math.max(0, Math.round((refund - ourLeft) * 100) / 100))
      : Math.floor(refund * ratio * 100) / 100;
  const fromUs = Math.round((refund - fromPro) * 100) / 100;
  const take = opts.paid - opts.payout;
  return { refund, fromPro, fromUs, newPayout: Math.round((opts.payout - fromPro) * 100) / 100, takeAfter: Math.round((take - fromUs) * 100) / 100 };
}

/**
 * Deposits. Big tickets (site-visit work, events, or $1,000+) can be booked with a deposit:
 * 30% (50% for events), at least $100. The balance is due a few days before the job (7 for
 * events) and is charged to the saved card automatically. Jobs that are too close to the
 * date to leave room for the balance are paid in full.
 */
export const DEPOSIT = { share: 0.3, eventShare: 0.5, minimum: 100, threshold: 1000, balanceDaysBefore: 3, eventBalanceDaysBefore: 7 } as const;

export function depositPolicy(slug: string, price: number | null | undefined, scheduledDate?: string | null, now = new Date()) {
  const svc = getService(slug);
  const none = { allowed: false, amount: 0, balance: 0, balanceDue: null as string | null, share: 0 };
  if (!svc || !price || price <= 0) return none;
  if (!(svc.siteVisit || svc.category === "events" || price >= DEPOSIT.threshold)) return none;
  const events = svc.category === "events";
  const daysBefore = events ? DEPOSIT.eventBalanceDaysBefore : DEPOSIT.balanceDaysBefore;
  let balanceDue: string | null = null;
  if (scheduledDate) {
    const due = new Date(`${scheduledDate}T12:00:00`);
    due.setDate(due.getDate() - daysBefore);
    if (due.getTime() <= now.getTime()) return none; // too close — pay in full
    balanceDue = due.toISOString().slice(0, 10);
  }
  const share = events ? DEPOSIT.eventShare : DEPOSIT.share;
  const amount = Math.min(Math.round(price) - 1, Math.max(DEPOSIT.minimum, Math.round(price * share)));
  return { allowed: amount > 0, amount, balance: Math.round(price) - amount, balanceDue, share };
}
