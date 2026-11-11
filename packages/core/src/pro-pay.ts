/*
 * FILE    : packages/core/src/pro-pay.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-06_1800 UTC
 * PURPOSE : The one pay number a pro sees: their NET pay for a job. Pros never see the math behind it (job price,
 *           Handled's take, the referral partner split). On a partner-referred job the pro's half of the partner's fee
 *           is already taken out:
 *             net = agreed payout − the pro's half of the referral fee (0 for a direct sale or a non-referred job)
 *           The fee is the same one lib/partners.ts takes at completion (partnerSplitForJob): the rate locked on the job
 *           (partner-v4), or the tier rate for older jobs, and only when the pro's signed agreement covers it.
 *           Once the job is completed, the fee actually taken (jobs.partner_pro_fee) is used.
 *           Handled's numbers (price, take, partner split) stay internal: Hub → job money.
 */
import { AGREEMENT_VERSION } from "./compliance.ts";
import { partnerSplit, type PartnerTier } from "./partners.ts";

export type ProPayJob = {
  price_final?: number | null; amount_refunded?: number | null;
  partner_id?: string | null; partner_tier?: PartnerTier | null; partner_rate?: number | null; partner_sale?: boolean | null;
  partner_pro_fee?: number | null; status?: string | null;
};

/** Does this pro's signed agreement cover the referral fee on this job? (v11+ for partner-v4 jobs, v10+ for older ones) */
export function proPaysReferralFee(job: ProPayJob, agreementVersion: string | null | undefined): boolean {
  const v = String(agreementVersion ?? "");
  return job.partner_rate != null ? v >= AGREEMENT_VERSION : v >= "2026-10-v10";
}

/** The pro's half of the referral fee on this job at this payout (hidden from the pro; it's already out of their pay). */
export function proReferralFee(job: ProPayJob, payout: number | null | undefined, agreementVersion: string | null | undefined): number {
  const pay = Number(payout ?? 0);
  if (!(pay > 0) || !job.partner_id || job.partner_sale || !job.partner_tier) return 0;
  if (job.status === "completed" && job.partner_pro_fee != null) return Math.min(pay, Number(job.partner_pro_fee));
  if (!proPaysReferralFee(job, agreementVersion)) return 0;
  return partnerSplit({ price: Number(job.price_final ?? 0), payout: pay, refunded: Number(job.amount_refunded ?? 0), tier: job.partner_tier, rate: job.partner_rate ?? null }).fromPro;
}

/** The pro's net pay: the only pay number shown to a pro (offers, work orders, the pro portal and the app). */
export function proNetPay(job: ProPayJob, payout: number | null | undefined, agreementVersion: string | null | undefined): number {
  const pay = Number(payout ?? 0);
  return Math.round((pay - proReferralFee(job, pay, agreementVersion)) * 100) / 100;
}
