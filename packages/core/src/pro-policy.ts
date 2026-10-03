/*
 * FILE    : packages/core/src/pro-policy.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2124 UTC
 * UPDATED : 2026-10-03_0119 UTC — pay protection can't be switched off (pro agreement promise).
 * PURPOSE : The six Pro Program benefits and the rules for who qualifies. The defaults
 *           live here; Handled Hub → Pro Program saves overrides in the database
 *           (pro_program_settings). Every benefit is designed to keep a job at or above $0
 *           for us, except the guaranteed minimum, which is an explicit, budget-capped
 *           cost that is off by default and needs staff approval for every top-up.
 *             1. payProtection  — refunds that aren't the pro's fault come out of our take
 *             2. showUpPay      — the pro gets part of the late-cancel / lockout fee
 *             3. instantPay     — cash out approved payouts now, for a small fee
 *             4. insurance      — partner brokers + a one-time insurance stipend
 *             5. materials      — parts reimbursed at cost with a receipt, billed to the customer
 *             6. guarantee      — weekly minimum for top pros in peak season
 */
import { CARD_FEE, money } from "./pricing.ts";
import { PRO_TIERS, proTier, type ProTierId } from "./pro-program.ts";
import { LATE_CANCEL_FEE } from "./compliance.ts";
import type { Contractor } from "./types.ts";

/** Who qualifies for a benefit. Empty trades = every trade. */
export interface QualifyRule {
  enabled: boolean;
  minTier: ProTierId;
  minJobs: number;
  minRating: number;
  trades: string[];
}

export interface ProPolicy {
  payProtection: QualifyRule;
  showUpPay: QualifyRule & { amount: number };
  instantPay: QualifyRule & { feePct: number; minFee: number; minAmount: number };
  insurance: QualifyRule & { stipend: number; afterJobs: number; partners: { name: string; url: string; phone: string; covers: string; code: string }[] };
  /** Shopping trades (errands) buy goods for the customer: capped in dollars, not as a share of the price. */
  materials: QualifyRule & { autoApproveUpTo: number; maxShareOfPrice: number; shoppingTrades: string[]; shoppingMax: number };
  guarantee: QualifyRule & { weeklyMinimum: number; months: number[]; minAcceptance: number; minDaysAvailable: number; weeklyBudget: number };
}

const rule = (r: Partial<QualifyRule> = {}): QualifyRule => ({ enabled: true, minTier: "pro", minJobs: 0, minRating: 0, trades: [], ...r });

export const PRO_POLICY_DEFAULTS: ProPolicy = {
  payProtection: rule(),
  showUpPay: { ...rule(), amount: 35 },
  instantPay: { ...rule({ minJobs: 5 }), feePct: 0.015, minFee: 0.5, minAmount: 25 },
  insurance: {
    ...rule({ minJobs: 10, minRating: 4.6 }), stipend: 150, afterJobs: 10,
    partners: [{ name: "Your insurance partner (set in Hub → Pro Program)", url: "", phone: "", covers: "General liability, commercial auto, bonds, workers' comp", code: "" }],
  },
  materials: { ...rule({ trades: ["handyman", "plumbing", "electrical", "hvac", "low_voltage", "remodel", "gutters", "pressure_washing", "errands", "dumpster"] }), autoApproveUpTo: 75, maxShareOfPrice: 0.5, shoppingTrades: ["errands"], shoppingMax: 300 },
  guarantee: { ...rule({ enabled: false, minTier: "elite", trades: ["snow", "lawn", "cleaning"] }), weeklyMinimum: 800, months: [1, 2, 5, 6, 7, 12], minAcceptance: 0.9, minDaysAvailable: 5, weeklyBudget: 2000 },
};

/** Merge saved Hub settings over the defaults, one benefit and one field at a time. */
export function mergePolicy(saved: Partial<Record<keyof ProPolicy, Record<string, unknown>>> | null | undefined): ProPolicy {
  const out = structuredClone(PRO_POLICY_DEFAULTS) as unknown as Record<string, Record<string, unknown>>;
  for (const [k, v] of Object.entries(saved ?? {})) if (out[k] && v && typeof v === "object") out[k] = { ...out[k], ...v };
  // Pay protection is a promise in the pro agreement — always on, for every pro, whatever is saved.
  out.payProtection = structuredClone(PRO_POLICY_DEFAULTS.payProtection) as unknown as Record<string, unknown>;
  return out as unknown as ProPolicy;
}

type QualifyStats = Pick<Contractor, "jobs_completed" | "rating" | "on_time_rate" | "acceptance_rate" | "trades"> & { status?: string };

/** Does this pro qualify for the benefit? Returns the reason they don't, or null. */
export function whyNot(r: QualifyRule, c: QualifyStats, trade?: string): string | null {
  if (!r.enabled) return "not offered right now";
  if (c.status && c.status !== "approved") return "pro isn't active";
  const tierIdx = PRO_TIERS.findIndex((t) => t.id === proTier(c).id);
  const needIdx = PRO_TIERS.findIndex((t) => t.id === r.minTier);
  if (tierIdx < needIdx) return `needs ${PRO_TIERS[needIdx].name} tier`;
  if (c.jobs_completed < r.minJobs) return `needs ${r.minJobs} completed jobs`;
  if (Number(c.rating) < r.minRating) return `needs a ${r.minRating}★ rating`;
  if (r.trades.length) {
    const ts = trade ? [trade] : c.trades;
    if (!ts.some((t) => r.trades.includes(t))) return "not offered for this trade";
  }
  return null;
}
export const qualifies = (r: QualifyRule, c: QualifyStats, trade?: string) => whyNot(r, c, trade) === null;

/** Plain-language summary of a rule, for the Hub and the /pros page. */
export function ruleText(r: QualifyRule): string {
  if (!r.enabled) return "Off";
  const bits = [r.minTier === "pro" ? "All active pros" : `${PRO_TIERS.find((t) => t.id === r.minTier)?.name}+ pros`];
  if (r.minJobs) bits.push(`${r.minJobs}+ jobs`);
  if (r.minRating) bits.push(`${r.minRating}★+`);
  if (r.trades.length) bits.push(`trades: ${r.trades.join(", ")}`);
  return bits.join(" · ");
}

/**
 * Show-up pay on a late cancellation or lockout: the policy amount, but never more than the
 * fee we kept after the card processor's cost — so the cancelled job never costs us money.
 */
export function showUpPay(policy: ProPolicy, paid: number, fee = LATE_CANCEL_FEE): number {
  const cardCost = paid > 0 ? paid * CARD_FEE.pct + CARD_FEE.fixed : 0;
  return Math.max(0, Math.floor(Math.min(policy.showUpPay.amount, fee - cardCost)));
}

/** Instant-pay fee for cashing out `amount` now. */
export function instantPayFee(policy: ProPolicy, amount: number): number {
  return Math.round(Math.max(policy.instantPay.minFee, amount * policy.instantPay.feePct) * 100) / 100;
}

/** Materials: auto-approve, send to staff, or refuse (over the per-job cap). */
export function materialsDecision(policy: ProPolicy, amount: number, jobPrice: number, alreadyApproved = 0, trade?: string): "auto" | "review" | "over_cap" {
  const cap = trade && policy.materials.shoppingTrades.includes(trade) ? policy.materials.shoppingMax : jobPrice * policy.materials.maxShareOfPrice;
  if (amount + alreadyApproved > cap) return "over_cap";
  return amount <= policy.materials.autoApproveUpTo ? "auto" : "review";
}

/** Guaranteed-minimum top-up for one pro's week. Zero when the week doesn't count. */
export function guaranteeTopUp(policy: ProPolicy, week: { earned: number; offered: number; accepted: number; daysAvailable: number; month: number }): number {
  const g = policy.guarantee;
  if (!g.enabled || !g.months.includes(week.month)) return 0;
  if (week.daysAvailable < g.minDaysAvailable) return 0;
  if (week.offered > 0 && week.accepted / week.offered < g.minAcceptance) return 0;
  return Math.max(0, Math.round((g.weeklyMinimum - week.earned) * 100) / 100);
}

/** One-line descriptions of each benefit under the current policy (pros page, dashboard, agreement). */
export function benefitLines(p: ProPolicy) {
  return [
    { key: "payProtection" as const, title: "Pay protection", body: "If you did the job right and the customer still gets a refund, it comes out of our share, not your payout.", rule: p.payProtection },
    { key: "showUpPay" as const, title: "Show-up pay", body: `Customer cancels late or you can't get in? You get up to ${money(p.showUpPay.amount)} for the trip.`, rule: p.showUpPay },
    { key: "instantPay" as const, title: "Instant pay", body: `Cash out approved payouts any time to your debit card (fee ${(p.instantPay.feePct * 100).toFixed(1)}%), or wait for the free weekly run.`, rule: p.instantPay },
    { key: "insurance" as const, title: "Insurance help", body: `Fast quotes through our insurance partners, and a ${money(p.insurance.stipend)} insurance stipend after your ${p.insurance.afterJobs}th job.`, rule: p.insurance },
    { key: "materials" as const, title: "Materials reimbursed", body: "Parts, materials and errand shopping not included in the price are reimbursed at cost with a receipt.", rule: p.materials },
    { key: "guarantee" as const, title: "Guaranteed weekly minimum", body: `In peak season, top pros who stay available are guaranteed ${money(p.guarantee.weeklyMinimum)} a week.`, rule: p.guarantee },
  ];
}
