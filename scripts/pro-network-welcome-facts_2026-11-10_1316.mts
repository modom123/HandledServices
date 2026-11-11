// ============================================================================
// FILE    : scripts/pro-network-welcome-facts_2026-11-10_1316.mts
// PROJECT : Handled (HandledServices) — AI-run home & business services
// CREATED : 2026-11-10_1316 UTC
// PURPOSE : Prints the numbers the "Welcome to the Handled Network" PDF quotes, straight from the shared rules
//           (packages/core), as JSON. Called by scripts/build-pro-network-welcome-pdf_2026-11-10_1316.py so the PDF
//           never drifts from what the portal and the welcome email say. Benefit amounts are the Pro Program
//           defaults (Hub → Pro Program can change them; the welcome email uses the live settings).
// ============================================================================
import {
  BRAND, PARTNER_LADDER, PARTNER_PROGRAM, PROBATION, PRO_POLICY_DEFAULTS, PRO_REFERRAL, PRO_TIERS, REFERRAL_LADDER, REWARD_DEFAULTS,
  TENURE_TIERS, ladderTable,
} from "../packages/core/src/index.ts";

const pick = (rows: { level: number; rate: number; profit: number }[], levels: number[]) => rows.filter((r) => levels.includes(r.level)).map((r) => ({ rate: r.rate, credit: r.profit }));
const P = PRO_POLICY_DEFAULTS;
console.log(JSON.stringify({
  phone: BRAND.supportPhone, email: BRAND.supportEmail,
  tiers: PRO_TIERS.map((t) => ({ name: t.name, jobs: t.min.jobs, rating: t.min.rating, onTime: t.min.onTime, boost: t.payoutBoost })),
  probation: PROBATION,
  instantPay: { minJobs: P.instantPay.minJobs, feePct: P.instantPay.feePct, minFee: P.instantPay.minFee },
  showUpPay: P.showUpPay.amount,
  insurance: { stipend: P.insurance.stipend, afterJobs: P.insurance.afterJobs },
  materials: { autoApproveUpTo: P.materials.autoApproveUpTo },
  referral: PRO_REFERRAL,
  rewards: { earnRate: REWARD_DEFAULTS.earnRate, quality: REWARD_DEFAULTS.qualityMultiplier, minRating: REWARD_DEFAULTS.minRatingForQuality, pendingDays: REWARD_DEFAULTS.pendingDays, expiryMonths: REWARD_DEFAULTS.inactivityExpiryMonths },
  tenure: TENURE_TIERS.map((t) => ({ label: t.en, multiplier: t.multiplier })),
  partner: { months: PARTNER_PROGRAM.months, holdDays: PARTNER_PROGRAM.holdDays },
  referralLadder: pick(ladderTable(REFERRAL_LADDER), [0, 1, 2, 5, 10, 15]),
  salesLadder: pick(ladderTable(PARTNER_LADDER), [0, 1, 2, 5, 10, 20, 35]),
  fastTrack: { jobsPerStep: PARTNER_LADDER.jobsPerStep, capRate: PARTNER_LADDER.jobsCapRate, directCredit: PARTNER_LADDER.directCredit },
}));
