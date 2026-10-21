/*
 * FILE    : packages/core/src/pro-rates.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0200 UTC
 * PURPOSE : The dynamic marketplace — pros set their own prices, customers still see one upfront, all-in price.
 *             PRO_RATE_BAND   — a pro prices each service at 80–175% of Handled's suggested pay for the job
 *             proPrice        — suggested price + the pro's % (+ their minimum job) → the customer's all-in price and
 *                               the pro's pay. Built with priceForPayout, so Handled's commission and booking fee are
 *                               the same rules as every other job (the pro keeps their whole rate; a pricier pro never
 *                               costs us margin, a cheaper one never cuts it). Same function in the browser and at
 *                               booking, so the price shown is the price charged.
 *             rankProOffers   — the 2–3 pro prices shown next to Handled's price: quality and reliability first, then
 *                               price; honest labels (Best value, Top rated, New on Handled)
 *             rateStats       — the local market for a service (median %, middle half) for pros' price cards
 *             QUOTE_REQUEST / quoteCustomerPrice — request-a-quote for big jobs: up to 3 pros, 24 hours, each pro names
 *                               their pay and the customer sees the all-in price
 */
import { priceForPayout, splitJob } from "./pricing.ts";

export const PRO_RATE_BAND = { min: 80, max: 175 } as const;
export const clampPct = (p: number) => Math.min(PRO_RATE_BAND.max, Math.max(PRO_RATE_BAND.min, Math.round(Number(p) || 100)));

/** The customer's all-in price and the pro's pay when a pro prices this job at `pct`% of the suggested pay. */
export function proPrice(suggested: number, pct: number, slug?: string, minJob?: number | null): { price: number; payout: number } {
  const base = splitJob(Math.max(1, Math.round(suggested)), slug).payout;
  const want = Math.max(1, Math.floor((base * clampPct(pct)) / 100));
  let price = priceForPayout(want, slug);
  if (minJob && minJob > price) price = Math.round(minJob);
  return { price, payout: splitJob(price, slug).payout };
}

export interface ProRateRow { pro_id: string; name: string; rating: number; jobs_completed: number; on_time_rate: number; pct: number; min_job: number | null }
export interface ProOffer extends ProRateRow { price: number; payout: number; score: number; badges: string[] }

/**
 * Score and order pro offers (100 points): rating 35, on time 20, experience 10, price 35 (relative to Handled's price,
 * so a cheaper pro scores higher, but never enough to beat a much better pro). Returns the best `max`, with labels.
 */
export function rankProOffers(rows: ProRateRow[], suggested: number, slug?: string, max = 3): ProOffer[] {
  if (!rows.length || !(suggested > 0)) return [];
  const offers = rows.map((r) => {
    const { price, payout } = proPrice(suggested, r.pct, slug, r.min_job);
    const priceScore = Math.max(0, Math.min(1, (1.75 - price / suggested) / 0.95)); // 0.8× → 1, 1.75× → 0
    const score = 35 * Math.max(0, Math.min(1, (Number(r.rating) - 3) / 2)) + 20 * Math.max(0, Math.min(1, Number(r.on_time_rate))) + 10 * Math.min(1, r.jobs_completed / 50) + 35 * priceScore;
    return { ...r, price, payout, score: Math.round(score * 10) / 10, badges: [] as string[] };
  }).sort((a, b) => b.score - a.score || a.price - b.price).slice(0, max);
  const cheapest = Math.min(...offers.map((o) => o.price));
  const topRating = Math.max(...offers.map((o) => Number(o.rating)));
  for (const o of offers) {
    if (o.price === cheapest && offers.length > 1) o.badges.push("Best value");
    if (Number(o.rating) === topRating && Number(o.rating) >= 4.8 && o.jobs_completed >= 10) o.badges.push("Top rated");
    if (o.jobs_completed < 5) o.badges.push("New on Handled");
  }
  return offers;
}

/** The local market for a service: how other pros price it (median and middle half), when there are enough of them. */
export function rateStats(pcts: number[]): { count: number; median: number | null; low: number | null; high: number | null } {
  const s = pcts.filter((p) => Number.isFinite(p)).sort((a, b) => a - b);
  if (s.length < 3) return { count: s.length, median: null, low: null, high: null };
  const at = (q: number) => s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))];
  return { count: s.length, median: at(0.5), low: at(0.25), high: at(0.75) };
}

/** Request-a-quote for big jobs: how many pros are asked, how long they have, how long the request stays open. */
export const QUOTE_REQUEST = { maxPros: 3, replyHours: 24, openDays: 7, minPay: 50, maxPay: 250_000 } as const;

/** What the customer pays for a pro's quoted pay (same commission and fee rules as every job). */
export const quoteCustomerPrice = (pay: number, slug?: string) => priceForPayout(Math.max(1, Math.round(pay)), slug);
