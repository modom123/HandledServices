/*
 * FILE    : packages/core/src/quote-learning.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-27_1800 UTC
 * PURPOSE : The AI quote learns (owner, 2026-11-27: "this AI quoting will learn from market research and booked jobs").
 *           The price always comes from the rules engine; what it learns is the market factor per service and ZIP area
 *           (marketFactor in pricing.ts, bounded 0.85–1.30×, damped, 8+ samples), which every quote, the booking page
 *           and Get it Handled use. Three sources feed it, all as the same kind of signal (price vs. what we suggested):
 *             • pros: accept / decline / counter / nobody took it (price_signals, since 2026-10-03)
 *             • booked jobs: what the finished job really came to (price + work added on site) vs. what we quoted;
 *               jobs refunded half or more are left out (a bad job isn't a price lesson)        bookedJobSignals()
 *             • market research: what other companies charge for a typical job (Hub → Pricing → Market research),
 *               compared with our typical price; each entry counts as RESEARCH_WEIGHT signals and
 *               anything wildly off (under half or over double ours) is ignored as a typo      researchSignals()
 */
import type { PriceSignal } from "./pricing.ts";

export const QUOTE_LEARNING = {
  /** Finished jobs this recent teach the quote. */
  bookedDays: 120,
  /** Market research this recent counts. */
  researchDays: 365,
  /** One research entry counts as this many signals (a researched price is a strong, deliberate data point). */
  researchWeight: 2,
} as const;

export interface FinishedJob { suggested: number; final: number; scopeExtra?: number; refunded?: number; paid?: number }

/** Finished jobs → signals: what it really came to (with work added on site) vs. what we quoted. */
export function bookedJobSignals(jobs: FinishedJob[]): PriceSignal[] {
  return jobs.filter((j) => j.suggested > 0 && j.final > 0 && !((j.refunded ?? 0) > 0 && (j.refunded ?? 0) >= (j.paid ?? 0) / 2))
    .map((j) => ({ price: Math.round((j.final + Math.max(0, j.scopeExtra ?? 0)) * 100) / 100, suggested: j.suggested, outcome: "accepted" as const, counter: null }));
}

export interface ResearchEntry { typical: number }

/** Market research → signals against our typical price for the same job. */
export function researchSignals(rows: ResearchEntry[], ourTypical: number): PriceSignal[] {
  if (!(ourTypical > 0)) return [];
  return rows.filter((r) => r.typical > 0 && r.typical >= ourTypical * 0.5 && r.typical <= ourTypical * 2)
    .flatMap((r) => Array.from({ length: QUOTE_LEARNING.researchWeight }, () => ({ price: r.typical, suggested: ourTypical, outcome: "accepted" as const, counter: null })));
}
