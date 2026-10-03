/*
 * FILE    : packages/core/src/pro-program.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2101 UTC
 * UPDATED : 2026-10-02_0233 UTC — promises match what the system does: free automatic Monday payouts
 *           (instant cash-out optional), recurring visits offered to the same pro first, daily limit.
 * UPDATED : 2026-10-03_0115 UTC — tiers no longer depend on accepting offers (declining is always free;
 *           independent-contractor safeguard).
 * PURPOSE : The Handled Pro Program — what we offer subcontractors. Tiers earned from real
 *           performance (jobs, rating, on-time) unlock a bigger payout share and
 *           first pick of offers. Every boost is clamped so our take never drops below
 *           TAKE_MIN (15%), so better pay for the best pros can never make a job lose money.
 */
import { TAKE_MIN, estimate, money, splitJob } from "./pricing.ts";
import { defaultAnswers, getService } from "./services.ts";
import type { Contractor } from "./types.ts";

export type ProTierId = "pro" | "pro_plus" | "elite";

export interface ProTier {
  id: ProTierId;
  name: string;
  badge: string;
  /** Extra share of the job price added to the payout (clamped at the TAKE_MIN floor). */
  payoutBoost: number;
  /** Added to the dispatch score, so higher tiers see offers first. */
  dispatchBoost: number;
  min: { jobs: number; rating: number; onTime: number };
  perks: string[];
}

export const PRO_TIERS: ProTier[] = [
  {
    id: "pro", name: "Pro", badge: "✓", payoutBoost: 0, dispatchBoost: 0,
    min: { jobs: 0, rating: 0, onTime: 0 },
    perks: ["Prepaid, pre-priced jobs in your area", "Weekly payouts", "No lead fees, no subscription"],
  },
  {
    id: "pro_plus", name: "Pro+", badge: "★", payoutBoost: 0.03, dispatchBoost: 6,
    min: { jobs: 25, rating: 4.7, onTime: 0.9 },
    perks: ["+3% of the job price on every payout", "Ranked ahead of Pro-tier pros for every offer"],
  },
  {
    id: "elite", name: "Elite", badge: "◆", payoutBoost: 0.05, dispatchBoost: 12,
    min: { jobs: 100, rating: 4.85, onTime: 0.95 },
    perks: ["+5% of the job price on every payout", "Top of the list for every offer, including large and commercial jobs"],
  },
];

type TierStats = Pick<Contractor, "jobs_completed" | "rating" | "on_time_rate">;

const meets = (c: TierStats, t: ProTier) =>
  c.jobs_completed >= t.min.jobs && Number(c.rating) >= t.min.rating && Number(c.on_time_rate) >= t.min.onTime;

/** The highest tier the pro qualifies for right now (recomputed from live stats, never stale). */
export function proTier(c: TierStats): ProTier {
  return [...PRO_TIERS].reverse().find((t) => meets(c, t)) ?? PRO_TIERS[0];
}

/** What's left to reach the next tier, for the pro's dashboard. */
export function nextTierProgress(c: TierStats): { next: ProTier | null; todo: string[] } {
  const i = PRO_TIERS.indexOf(proTier(c));
  const next = PRO_TIERS[i + 1] ?? null;
  if (!next) return { next: null, todo: [] };
  const todo: string[] = [];
  if (c.jobs_completed < next.min.jobs) todo.push(`${next.min.jobs - c.jobs_completed} more completed jobs`);
  if (Number(c.rating) < next.min.rating) todo.push(`rating ${next.min.rating}★+ (now ${Number(c.rating).toFixed(2)})`);
  if (Number(c.on_time_rate) < next.min.onTime) todo.push(`on time ${Math.round(next.min.onTime * 100)}%+ (now ${Math.round(Number(c.on_time_rate) * 100)}%)`);
  return { next, todo };
}

/**
 * The payout a given pro is offered: the base payout plus their tier boost, never more than
 * (1 − TAKE_MIN) of the price. Services already paying at the cap get no boost. Rounds down.
 */
export function tierPayout(price: number | null | undefined, basePayout: number | null | undefined, tier: ProTier): number {
  const base = Number(basePayout ?? 0);
  const p = Number(price ?? 0);
  if (!(p > 0) || !(base > 0) || !tier.payoutBoost) return base;
  const cap = Math.floor(p * (1 - TAKE_MIN));
  return Math.max(base, Math.min(cap, Math.floor(base + p * tier.payoutBoost)));
}

/** One-time bonus for referring a pro, paid after their 10th completed job (from our take). */
export const PRO_REFERRAL = { bonus: 150, afterJobs: 10 };

/** Plain-language promises shown on the recruiting page and in the pro agreement summary. */
export const PRO_PROMISES = [
  { t: "You see the pay before you say yes", b: "Every offer shows the scope, the date and your exact payout. That number is what you get. No bidding and no haggling with customers." },
  { t: "The customer has already paid", b: "Customers pay us before you're dispatched, so you never chase money, send invoices or wait on a check." },
  { t: "No lead fees. No subscription. No software bill.", b: "You pay nothing to join and nothing per lead, and the weekly payout is free. We only make money when you make money. (Want your money today instead? Instant cash-out is optional, for a small fee.)" },
  { t: "Paid every week", b: "Payouts are approved as soon as the job passes photo review and are sent automatically every Monday to your bank through Stripe, with a clear statement for every job." },
  { t: "We run the office", b: "Marketing, quoting, scheduling, reminders, payments, reviews and customer support are all handled by our team and AI. You just do the work." },
  { t: "Recurring customers stay with you", b: "When a customer signs up for a recurring plan, every visit is offered to you first, a full day before anyone else sees it. That builds a steady route instead of one-off jobs." },
  { t: "You stay independent", b: "Accept the jobs you want, set your service area, work days and daily job limit (we never offer past it), and keep your own business and other clients." },
];

/** Typical payouts per job for the recruiting page, computed from the live pricing engine. */
export function samplePayouts(slugs: string[]) {
  return slugs.flatMap((slug) => {
    const svc = getService(slug);
    if (!svc) return [];
    const price = estimate({ slug, answers: defaultAnswers(svc) }).point;
    const base = splitJob(price, slug).payout;
    const elite = tierPayout(price, base, PRO_TIERS[2]);
    return [{ slug, name: svc.name, icon: svc.icon, price, payout: base, elite, label: `${money(base)}${elite > base ? ` – ${money(elite)}` : ""}` }];
  });
}
