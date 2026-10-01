/*
 * FILE    : packages/core/src/pricing.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
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
  const low = roundTo(point * service.spread[0], step);
  const high = roundTo(point * service.spread[1], step);
  const payout = Math.round(point * service.payoutShare);
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
