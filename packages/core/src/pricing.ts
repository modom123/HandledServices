/*
 * FILE    : packages/core/src/pricing.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-01_1830 UTC — splitJob(): one place that splits every price between the
 *           subcontractor and us. Our take is always 15–35% of the job (TAKE_MIN/MAX),
 *           payouts round down (in our favor), card fees are estimated so the hub shows
 *           net per job. Enforced again in the database (jobs_take_rate_band).
 * UPDATED : 2026-10-03_0144 UTC — market pricing: a $4 booking fee the customer pays (kept by us), a commission
 *           that slides with job size (15% on small jobs → 32% on $600+), priceForPayout() for pro counters,
 *           and a learned local market factor (marketFactor) applied to the suggested price.
 * UPDATED : 2026-10-03_1247 UTC — per-service commission cap (Service.maxCommission) for equipment-heavy jobs
 *           like water heaters, where the unit is most of the price.
 * UPDATED : 2026-10-04_1950 UTC — typicalPrice / priceHint: service lists show a typical job ("typically $X"), not the minimum.
 * PURPOSE : Deterministic instant-quote engine. Produces the price range shown to the
 *           customer, the subcontractor payout and the platform margin. The AI quote
 *           (apps/web/lib/ai/quote.ts) may adjust inside guardrails but never below the
 *           service minimum or outside ±40% of this baseline.
 */

import { defaultAnswers, getService, type Answers, type LineItem } from "./services.ts";
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

/** Paid by the customer on every booking (each visit for plans); kept by us, never shared or discounted. */
export const BOOKING_FEE = 4;
/** No booking fee on tiny or free jobs (redos, complimentary). */
const FEE_FROM = 20;
export const bookingFeeOf = (price: number) => (price >= FEE_FROM ? BOOKING_FEE : 0);

/**
 * Commission on the service price (price minus the booking fee) — small jobs carry a small cut so
 * pros earn a fair amount on a $60 mow; big jobs carry more. Linear from 15% at $60 to 32% at $600+.
 * Payout still rises with every extra dollar of price.
 */
export const COMMISSION = { minRate: 0.15, maxRate: 0.32, from: 60, to: 600 } as const;
export function commissionRate(servicePrice: number, slug?: string): number {
  const t = Math.min(1, Math.max(0, (servicePrice - COMMISSION.from) / (COMMISSION.to - COMMISSION.from)));
  const cap = (slug && getService(slug)?.maxCommission) || TAKE_MAX;
  return Math.min(cap, TAKE_MAX, Math.max(TAKE_MIN, COMMISSION.minRate + (COMMISSION.maxRate - COMMISSION.minRate) * t));
}
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
  /** Booking fee included in `price` (ours, outside the commission). */
  fee: number;
}

/**
 * Split a job price (booking fee included) between the pro and us: the booking fee is ours; the
 * commission slides with the service price (commissionRate), always within TAKE_MIN–TAKE_MAX; the
 * payout rounds DOWN to the dollar so rounding can never cost us money.
 */
export function splitJob(price: number, slug?: string): JobSplit {
  const fee = bookingFeeOf(price);
  const service = Math.max(0, price - fee);
  const payout = price > 0 ? Math.floor(service * (1 - commissionRate(service, slug))) : 0;
  const take = Math.round((price - payout) * 100) / 100;
  const cardFee = price > 0 ? Math.round((price * CARD_FEE.pct + CARD_FEE.fixed) * 100) / 100 : 0;
  return { price, payout, take, takeRate: price > 0 ? take / price : 0, cardFee, net: Math.round((take - cardFee) * 100) / 100, fee };
}

/** The lowest customer price (whole dollars, booking fee included) that pays the pro at least `payout` — for counters. */
export function priceForPayout(payout: number, slug?: string): number {
  let lo = Math.max(1, Math.floor(payout)), hi = Math.ceil(payout / (1 - TAKE_MAX)) + BOOKING_FEE + 2;
  while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (splitJob(mid, slug).payout >= payout) hi = mid; else lo = mid + 1; }
  return lo;
}

/**
 * Guardrails on the AI price check, relative to the rules-engine baseline. Asymmetric on
 * purpose, so a job is never underbid: the AI may raise a price up to 40% (anything bigger
 * becomes a free site visit instead of a capped, too-low price) but may cut it by at most 10%.
 */
export const AI_MAX_ADJUST = 0.4;
export const AI_MAX_RAISE = 0.4;
export const AI_MAX_CUT = 0.1;

export interface EstimateInput {
  slug: string;
  answers: Answers;
  frequency?: Frequency;
  customerType?: CustomerType;
  rush?: boolean;
  /** Learned local market factor for this service and area (1 = no change). See marketFactor(). */
  market?: number;
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
  /** Booking fee included in point/low/high. */
  fee: number;
  /** Market factor that was applied. */
  market: number;
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
  // what pros in this area actually accept (learned from offers; ±, bounded) — see marketFactor()
  const market = clampFactor(input.market ?? 1);
  if (market !== 1 && !service.siteVisit) {
    const m = Math.round(point * (market - 1));
    if (m) { lines.push({ label: "Local market adjustment", amount: m }); point += m; }
  }

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
  // the range always contains the price: low rounds down, high rounds up
  const low = exact ? Math.round(point) : Math.min(Math.round(point), Math.floor((point * service.spread[0]) / step) * step);
  const high = exact ? Math.round(point) : Math.max(Math.round(point), Math.ceil((point * service.spread[1]) / step) * step);
  // the booking fee goes on last: never discounted, never part of the pro's share
  const fee = bookingFeeOf(Math.round(point));
  if (fee) lines.push({ label: "Booking fee", amount: fee });
  const total = Math.round(point) + fee;
  const { payout } = splitJob(total, service.slug);
  return {
    slug: service.slug,
    items: lines,
    point: total,
    low: Math.max(low, Math.round(service.minimum * (1 - discount))) + fee,
    high: high + fee,
    hours: Math.round(hours * 10) / 10,
    siteVisit: service.siteVisit,
    discount,
    payout,
    margin: total - payout,
    payoutShare: service.payoutShare,
    fee,
    market,
  };
}

/** Clamp an AI-proposed price to the guardrails around the baseline. */
export function clampAiPrice(baseline: Estimate, proposed: number): number {
  const svc = getService(baseline.slug)!;
  const lo = Math.max(svc.minimum * (1 - baseline.discount), baseline.point * (1 - AI_MAX_CUT));
  const hi = baseline.point * (1 + AI_MAX_RAISE);
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

/** Market factors stay within these bounds (a guardrail on what the data can do to a price). */
export const MARKET_BOUNDS = { min: 0.85, max: 1.3, minSamples: 8 } as const;
export const clampFactor = (f: number) => (Number.isFinite(f) && f > 0 ? Math.min(MARKET_BOUNDS.max, Math.max(MARKET_BOUNDS.min, Math.round(f * 100) / 100)) : 1);

/** One offer outcome: what the price was vs our suggestion, and what happened. */
export interface PriceSignal { price: number; suggested: number; outcome: "accepted" | "declined" | "countered" | "expired"; counter?: number | null }

/**
 * Learn the local market from offers. Each outcome says where the clearing price sits relative to our
 * suggestion: an accept at 0.9× says 0.9× works; a counter at 1.15× says ~1.15×; a decline or an expiry
 * at 1.0× says "a bit more than 1.0×". Target = median of those; move halfway from the current factor
 * (damped), bounded by MARKET_BOUNDS, only with enough samples.
 */
export function marketFactor(signals: PriceSignal[], current = 1): { factor: number; samples: number; target: number | null } {
  const ratios = signals.filter((s) => s.suggested > 0 && s.price > 0).map((s) => {
    const r = s.price / s.suggested;
    if (s.outcome === "accepted") return r;
    if (s.outcome === "countered" && s.counter) return s.counter / s.suggested;
    return r * 1.08; // declined / nobody took it at this price
  }).sort((a, b) => a - b);
  if (ratios.length < MARKET_BOUNDS.minSamples) return { factor: clampFactor(current), samples: ratios.length, target: null };
  const mid = Math.floor(ratios.length / 2);
  const target = ratios.length % 2 ? ratios[mid] : (ratios[mid - 1] + ratios[mid]) / 2;
  return { factor: clampFactor(current * Math.pow(target, 0.5)), samples: ratios.length, target: Math.round(target * 100) / 100 };
}

/** Name-your-price bounds around the suggested price. Below `warn` the customer is told it may take longer. */
export const OFFER_BOUNDS = { min: 0.75, warn: 0.9, max: 3 } as const;
export function offerCheck(offer: number, suggested: number): { ok: boolean; level: "ok" | "low" | "too_low" | "too_high"; min: number; max: number } {
  const min = Math.ceil(suggested * OFFER_BOUNDS.min), max = Math.floor(suggested * OFFER_BOUNDS.max);
  if (!(offer > 0) || offer < min) return { ok: false, level: "too_low", min, max };
  if (offer > max) return { ok: false, level: "too_high", min, max };
  return { ok: true, level: offer < suggested * OFFER_BOUNDS.warn ? "low" : "ok", min, max };
}

/**
 * The price to show on a service list. Every order is different, so lists show what a TYPICAL job costs
 * (our calculator's default job, rounded to $5) rather than the minimum ticket, which only the smallest
 * jobs pay. Site-visit services show a free on-site quote; the event package is by budget.
 */
export function typicalPrice(slug: string): number | null {
  const s = getService(slug);
  if (!s || s.siteVisit) return null;
  return Math.round(estimate({ slug, answers: defaultAnswers(s) }).point / 5) * 5;
}

export function priceHint(slug: string, locale: string = "en"): string {
  const es = locale === "es";
  if (slug === "event-package") return es ? "Según su presupuesto" : "By budget";
  const p = typicalPrice(slug);
  if (p === null) return es ? "Cotización gratis en sitio" : "Free on-site quote";
  return es ? `normalmente ${money(p)}` : `typically ${money(p)}`;
}
