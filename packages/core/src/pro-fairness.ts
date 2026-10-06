/*
 * FILE    : packages/core/src/pro-fairness.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0117 UTC
 * PURPOSE : The rules behind the promises in the Independent Contractor Agreement, kept pure and
 *           tested:
 *             DEDUCTION_RULES / respondBy  — a deduction is only proposed: 3 business days to respond
 *             clawbackPlan                 — applied deductions never take more than half of a
 *                                            payout run, and never come out of tips
 *             chargebackFromWork           — only "not received / unacceptable" chargebacks can be
 *                                            about the pro's work; the rest release the payout
 *             DEACTIVATION_RULES / standingIssues — objective thresholds for a written warning
 *           UPDATED 2026-10-06_1950 UTC — late cancel = under 6h (CANCEL_POLICY); 6–24h is short notice, no penalty.
 *                                            (never an automatic deactivation)
 */
import { STATS_WINDOW_DAYS } from "./pro-stats.ts";
import { CANCEL_POLICY } from "./coverage.ts";

export const DEDUCTION_RULES = {
  /** Business days a pro has to respond before a person decides. */
  respondBusinessDays: 3,
  /** Most of a single payout run that applied deductions may take. */
  maxShareOfPayout: 0.5,
} as const;

export const DEACTIVATION_RULES = {
  /** Average rating below this over the last `ratedJobs` rated jobs → written warning, then review. */
  minRating: 4.3,
  ratedJobs: 20,
  /** A pro cancellation inside this many hours of the arrival window is a "late cancel" (6–24h is short notice: no penalty). */
  lateCancelHours: CANCEL_POLICY.lateHours,
  /** Cancelling at least this many hours ahead is free. */
  freeCancelHours: CANCEL_POLICY.freeHours,
  /** Late cancels or no-shows counted over this window. */
  windowDays: STATS_WINDOW_DAYS,
  lateCancels: 3,
  noShows: 2,
  /** First-time photo-QA failures (that the pro didn't fix) over the window. */
  qaFailures: 4,
  /** Days a pro has to improve after a written warning before a review. */
  improveDays: 30,
  /** Days to ask for an appeal; days we take to decide it. */
  appealDays: 14,
  decisionDays: 7,
  /** Background checks are repeated at least this often. */
  recheckDays: 365,
} as const;

/** `n` business days (Mon–Fri) after `from`, at the same time of day. */
export function addBusinessDays(from: Date, n: number): Date {
  const d = new Date(from.getTime());
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

export const respondBy = (from = new Date()) => addBusinessDays(from, DEDUCTION_RULES.respondBusinessDays);

/**
 * Which applied deductions (negative payout rows) settle in this payout run.
 * Base = the run's positive rows except tips; at most `maxShare` of it goes to deductions.
 * A deduction that doesn't fit is split: `apply` settles now, `carry` waits for the next run.
 */
export function clawbackPlan(
  positives: { amount: number; kind?: string | null }[],
  negatives: { id: string; amount: number }[],
  maxShare: number = DEDUCTION_RULES.maxShareOfPayout,
): { apply: { id: string; amount: number }[]; carry: { id: string; amount: number }[]; cap: number } {
  const base = positives.filter((p) => p.kind !== "tip").reduce((t, p) => t + Math.max(0, Number(p.amount)), 0);
  let room = Math.floor(base * maxShare * 100) / 100;
  const cap = room;
  const apply: { id: string; amount: number }[] = [];
  const carry: { id: string; amount: number }[] = [];
  for (const n of negatives) {
    const owed = Math.abs(Number(n.amount));
    const take = Math.min(owed, room);
    if (take > 0) { apply.push({ id: n.id, amount: Math.round(take * 100) / 100 }); room = Math.round((room - take) * 100) / 100; }
    if (owed - take > 0.004) carry.push({ id: n.id, amount: Math.round((owed - take) * 100) / 100 });
  }
  return { apply, carry, cap };
}

/** Stripe dispute reasons that can be about the work itself; everything else isn't the pro's doing. */
const WORK_REASONS = new Set(["product_not_received", "product_unacceptable"]);
export const chargebackFromWork = (reason: string | null | undefined) => WORK_REASONS.has(String(reason ?? ""));

export interface StandingStats {
  /** Ratings of the most recent rated jobs, newest first. */
  ratings: number[];
  lateCancels: number;
  noShows: number;
  qaFailures: number;
}

/** Objective reasons for a written warning (empty = in good standing). Plain English, shown to the pro. */
export function standingIssues(s: StandingStats, r = DEACTIVATION_RULES): string[] {
  const out: string[] = [];
  const rated = s.ratings.slice(0, r.ratedJobs);
  if (rated.length >= r.ratedJobs) {
    const avg = rated.reduce((t, x) => t + x, 0) / rated.length;
    if (avg < r.minRating) out.push(`average rating ${avg.toFixed(2)}★ over your last ${r.ratedJobs} rated jobs (minimum ${r.minRating}★)`);
  }
  if (s.lateCancels >= r.lateCancels) out.push(`${s.lateCancels} late cancellations in ${r.windowDays} days (limit ${r.lateCancels - 1})`);
  if (s.noShows >= r.noShows) out.push(`${s.noShows} no-shows in ${r.windowDays} days (limit ${r.noShows - 1})`);
  if (s.qaFailures >= r.qaFailures) out.push(`${s.qaFailures} photo-review failures not fixed in ${r.windowDays} days (limit ${r.qaFailures - 1})`);
  return out;
}
