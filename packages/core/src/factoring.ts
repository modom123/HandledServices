/*
 * FILE    : packages/core/src/factoring.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-06_0324 UTC
 * PURPOSE : Invoice factoring partners (Hub → Factoring). Business, city and government clients pay on net 30–60 while
 *           pros are paid in the weekly payout run; a factor advances most of an approved invoice in 1–2 days.
 *             FACTORING_STATUS_LABEL — outreach pipeline: to contact → emailed → call scheduled → quote received →
 *                                      applied → active (or passed)
 *             FACTORING_SAMPLE       — the one sample invoice every quote is compared on ($50,000, paid in 30 days)
 *             factoringCost          — cash up front, fee, total cost, effective annual rate and rebate for a quote
 *           Same math as docs/FACTORING_COMPARISON_2026-10-06_0320.xlsx → Cost Calculator.
 */

export type FactoringStatus = "to_contact" | "emailed" | "call_scheduled" | "quote_received" | "applied" | "active" | "passed";

export const FACTORING_STATUS_LABEL: Record<FactoringStatus, string> = {
  to_contact: "To contact",
  emailed: "Emailed",
  call_scheduled: "Call scheduled",
  quote_received: "Quote received",
  applied: "Applied",
  active: "Active partner",
  passed: "Passed",
};

/** Every quote is compared on this invoice so the totals line up (matches the workbook's defaults). */
export const FACTORING_SAMPLE = { invoice: 50000, daysToPay: 30 } as const;

export type FactoringQuote = {
  advanceRate: number | null; // fraction, 0.85 = 85%
  feePct: number | null; // fraction per fee period, 0.015 = 1.5%
  feePeriodDays?: number | null; // most factors bill per 30 days; some per 10 or 15
  flatFees?: number | null; // per-invoice ACH / processing fees
};

export type FactoringCost = { upFront: number; fee: number; totalCost: number; costPct: number; annualRate: number; rebate: number };

/** Cost of factoring one invoice under a quote, or null until the quote has an advance rate and a fee. */
export function factoringCost(q: FactoringQuote, invoice: number = FACTORING_SAMPLE.invoice, daysToPay: number = FACTORING_SAMPLE.daysToPay): FactoringCost | null {
  if (q.advanceRate == null || q.feePct == null || invoice <= 0 || daysToPay <= 0) return null;
  const periodDays = q.feePeriodDays && q.feePeriodDays > 0 ? q.feePeriodDays : 30;
  const periods = Math.ceil(daysToPay / periodDays);
  const upFront = invoice * q.advanceRate;
  const fee = invoice * q.feePct * periods;
  const totalCost = fee + (q.flatFees ?? 0);
  return {
    upFront,
    fee,
    totalCost,
    costPct: totalCost / invoice,
    annualRate: upFront > 0 ? (totalCost / upFront) * (365 / daysToPay) : 0,
    rebate: invoice - upFront - totalCost,
  };
}
