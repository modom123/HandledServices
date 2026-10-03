/*
 * FILE    : packages/core/src/pricing-accuracy.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_1253 UTC
 * PURPOSE : Pricing accuracy: did our suggested price match reality once the job was done?
 *           The market factor (pricing.ts → marketFactor) only learns from what pros do with an
 *           offer. This scores each service against what happened after: time on site vs. our
 *           estimate, the price the job really went for, work added on site, materials, what the
 *           pro made per hour, refunds and quote-to-booking conversion. Each signal becomes a
 *           weighted "price should be ×r" piece of evidence; together they give a verdict
 *           (underpriced / overpriced / on target), a confidence and a suggested factor.
 *           Pure and deterministic, so the Hub report and tests agree.
 */
import { clampFactor, splitJob } from "./pricing.ts";
import { getService } from "./services.ts";

/** One finished job. Prices include the booking fee; hours are null when not timed. */
export interface AccuracyJob {
  suggested: number;
  final: number;
  scopeExtra: number;
  refunded: number;
  paid: number;
  estHours: number | null;
  actualHours: number | null;
  expenses: number;
  rating: number | null;
}
/** Offer outcomes (price_signals) for the period; counterRatios = counter ÷ offered price. */
export interface AccuracySignals { accepted: number; declined: number; countered: number; expired: number; counterRatios: number[] }
export interface AccuracyInput { slug: string; jobs: AccuracyJob[]; signals: AccuracySignals; quotes: { saved: number; booked: number }; factor: number }

export type AccuracyVerdict = "underpriced" | "overpriced" | "on_target" | "watch" | "no_data";
export interface AccuracyEvidence { key: string; ratio: number; weight: number; reason: string }
export interface AccuracyMetrics {
  jobs: number; timed: number; signals: number;
  priceRatio: number | null; hoursRatio: number | null; proHourly: number | null;
  scopeRate: number | null; scopeShare: number | null; materialsShare: number | null;
  refundRate: number | null; avgRating: number | null;
  pushback: number | null; expiredRate: number | null; avgCounter: number | null; quoteConversion: number | null;
}
export interface AccuracyRow {
  slug: string; name: string; icon: string;
  verdict: AccuracyVerdict; confidence: "low" | "medium" | "high";
  /** Multiplier the evidence points to (1.12 = raise 12%), null without enough data. */
  change: number | null;
  factor: number;
  /** factor × change, kept inside the market bounds — what "Apply" sets. */
  suggestedFactor: number | null;
  metrics: AccuracyMetrics;
  evidence: AccuracyEvidence[];
  flags: string[];
}

/** Thresholds, in one place so the Hub page can explain them. */
export const ACCURACY_RULES = {
  minJobs: 5, minSignals: 8, mediumJobs: 10, highJobs: 20,
  /** Below this a pro won't stay on the service (payout ÷ actual hours, before their costs). */
  proHourlyFloor: 30,
  scopeRate: 0.25, materialsShare: 0.08, refundRate: 0.08, ratingFloor: 4.5,
  pushbackOk: 0.3, quoteConversionLow: 0.15, minQuotes: 10,
  /** |change − 1| under this is on target. */
  tolerance: 0.05,
  /** Biggest single move suggested at once. */
  maxStep: 0.2,
} as const;

const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const sum = (xs: number[]) => xs.reduce((t, x) => t + x, 0);
const r2 = (n: number) => Math.round(n * 100) / 100;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const usableHours = (h: number | null): h is number => h !== null && Number.isFinite(h) && h >= 0.1 && h <= 24;

export function scorePricing(input: AccuracyInput): AccuracyRow {
  const R = ACCURACY_RULES;
  const svc = getService(input.slug);
  const jobs = input.jobs.filter((j) => j.final > 0);
  const n = jobs.length;
  const timed = jobs.filter((j) => usableHours(j.actualHours) && (j.estHours ?? 0) > 0);
  const s = input.signals;
  const sigTotal = s.accepted + s.declined + s.countered + s.expired;

  const priceRatio = median(jobs.filter((j) => j.suggested > 0).map((j) => j.final / j.suggested));
  const hoursRatio = timed.length ? median(timed.map((j) => j.actualHours! / j.estHours!)) : null;
  const proHourly = timed.length ? median(timed.map((j) => splitJob(j.final, input.slug).payout / j.actualHours!)) : null;
  const finalSum = sum(jobs.map((j) => j.final));
  const scopeRate = n ? jobs.filter((j) => j.scopeExtra > 0).length / n : null;
  const scopeShare = finalSum ? sum(jobs.map((j) => j.scopeExtra)) / finalSum : null;
  const materialsShare = finalSum ? sum(jobs.map((j) => j.expenses)) / finalSum : null;
  const paidSum = sum(jobs.map((j) => j.paid));
  const refundRate = paidSum ? sum(jobs.map((j) => j.refunded)) / paidSum : null;
  const rated = jobs.map((j) => j.rating).filter((x): x is number => x !== null);
  const avgRating = rated.length ? sum(rated) / rated.length : null;
  const pushback = sigTotal ? (s.declined + s.countered + s.expired) / sigTotal : null;
  const expiredRate = sigTotal ? s.expired / sigTotal : null;
  const avgCounter = s.counterRatios.length ? sum(s.counterRatios) / s.counterRatios.length : null;
  const quoteConversion = input.quotes.saved ? input.quotes.booked / input.quotes.saved : null;

  const ev: AccuracyEvidence[] = [];
  const add = (key: string, ratio: number, weight: number, reason: string) => { if (weight > 0 && Number.isFinite(ratio) && ratio > 0) ev.push({ key, ratio: r2(ratio), weight: r2(weight), reason }); };

  if (hoursRatio !== null && timed.length >= 3 && Math.abs(hoursRatio - 1) >= 0.1)
    add("time", hoursRatio ** 0.6, Math.min(timed.length, 20) / 20, `Jobs take ${hoursRatio > 1 ? "longer" : "less time"} than we estimate: ${r2(hoursRatio)}× the estimated hours (median of ${timed.length})`);
  if (priceRatio !== null && n >= 3 && Math.abs(priceRatio - 1) >= 0.03)
    add("price", priceRatio, 0.8 * Math.min(n, 20) / 20, `Jobs end up ${priceRatio > 1 ? "above" : "below"} our suggestion: ${priceRatio > 1 ? "+" : "−"}${pct(Math.abs(priceRatio - 1))} (median of ${n}, after customer offers, raises and counters)`);
  if (scopeRate !== null && scopeShare !== null && n >= 3 && scopeRate >= R.scopeRate)
    add("scope", 1 + scopeShare * 0.5, 0.5, `${pct(scopeRate)} of jobs needed work added on site (${pct(scopeShare)} of revenue) — the booking questions miss something common`);
  if (sigTotal >= R.minSignals && pushback !== null) {
    if (pushback > R.pushbackOk) {
      const counterPull = avgCounter !== null ? (s.countered / sigTotal) * (avgCounter - 1) : 0;
      add("pros", 1 + counterPull + (pushback - R.pushbackOk) * 0.3, Math.min(sigTotal, 30) / 30, `Pros push back on ${pct(pushback)} of offers (${s.declined} passed, ${s.countered} countered${avgCounter ? ` asking ${pct(avgCounter - 1)} more` : ""}, ${s.expired} nobody took)`);
    } else if (pushback < 0.1 && s.accepted >= R.minSignals)
      add("pros", 0.97, 0.4 * Math.min(sigTotal, 30) / 30, `Pros take ${pct(1 - pushback)} of offers right away — there may be room to lower the price`);
  }
  if (proHourly !== null && timed.length >= 3 && proHourly < R.proHourlyFloor)
    add("hourly", Math.min(1.3, Math.sqrt(R.proHourlyFloor / proHourly)), 0.7, `Pros make about $${Math.round(proHourly)}/hour on site (before their costs), below the $${R.proHourlyFloor} floor — expect pros to stop taking these`);
  if (materialsShare !== null && materialsShare >= R.materialsShare)
    add("materials", 1 + materialsShare * 0.5, 0.4, `Reimbursed materials add ${pct(materialsShare)} on top — the price leaves out supplies most jobs need`);
  if (quoteConversion !== null && input.quotes.saved >= R.minQuotes && quoteConversion < R.quoteConversionLow && (pushback ?? 0) < 0.2)
    add("quotes", 0.95, 0.5, `Only ${pct(quoteConversion)} of saved quotes book (${input.quotes.booked} of ${input.quotes.saved}) while pros happily accept — the price may scare customers off`);

  const flags: string[] = [];
  if (refundRate !== null && refundRate >= R.refundRate) flags.push(`Refunds are ${pct(refundRate)} of revenue — a quality or expectation problem, not a price one`);
  if (avgRating !== null && rated.length >= 3 && avgRating < R.ratingFloor) flags.push(`Average rating ${avgRating.toFixed(1)}★ across ${rated.length} reviews`);
  if (expiredRate !== null && sigTotal >= R.minSignals && expiredRate >= 0.15) flags.push(`${pct(expiredRate)} of offers expired with nobody taking them — check pro supply in Gaps too`);

  const enough = n >= R.minJobs || sigTotal >= R.minSignals;
  const wsum = sum(ev.map((e) => e.weight));
  let change = enough && wsum ? Math.exp(sum(ev.map((e) => e.weight * Math.log(e.ratio))) / wsum) : enough ? 1 : null;
  if (change !== null) change = r2(Math.min(1 + R.maxStep, Math.max(1 - R.maxStep, change)));
  const verdict: AccuracyVerdict = change === null ? "no_data"
    : change >= 1 + R.tolerance ? "underpriced"
    : change <= 1 - R.tolerance ? "overpriced"
    : flags.length ? "watch" : "on_target";
  const confidence = n >= R.highJobs ? "high" : n >= R.mediumJobs || sigTotal >= 20 ? "medium" : "low";
  const suggestedFactor = change !== null && (verdict === "underpriced" || verdict === "overpriced") ? clampFactor(input.factor * change) : null;

  return {
    slug: input.slug, name: svc?.name ?? input.slug, icon: svc?.icon ?? "•",
    verdict, confidence, change, factor: input.factor, suggestedFactor,
    metrics: {
      jobs: n, timed: timed.length, signals: sigTotal,
      priceRatio: priceRatio === null ? null : r2(priceRatio), hoursRatio: hoursRatio === null ? null : r2(hoursRatio),
      proHourly: proHourly === null ? null : Math.round(proHourly), scopeRate, scopeShare, materialsShare, refundRate,
      avgRating: avgRating === null ? null : r2(avgRating), pushback, expiredRate, avgCounter: avgCounter === null ? null : r2(avgCounter), quoteConversion,
    },
    evidence: ev.sort((a, b) => b.weight - a.weight),
    flags,
  };
}

const ORDER: Record<AccuracyVerdict, number> = { underpriced: 0, overpriced: 1, watch: 2, on_target: 3, no_data: 4 };
/** Every service, worst first (most off, most confident). */
export function pricingAccuracy(inputs: AccuracyInput[]): AccuracyRow[] {
  return inputs.map(scorePricing).sort((a, b) => ORDER[a.verdict] - ORDER[b.verdict] || Math.abs((b.change ?? 1) - 1) - Math.abs((a.change ?? 1) - 1) || b.metrics.jobs - a.metrics.jobs);
}

