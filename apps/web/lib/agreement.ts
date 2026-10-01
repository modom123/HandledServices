/*
 * FILE    : apps/web/lib/agreement.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2000 UTC
 * PURPOSE : Independent Contractor Agreement (version AGREEMENT_VERSION) shown and signed in
 *           the pro portal. TEMPLATE — have an employment/contract lawyer in each state you
 *           operate in review it before use. Bumping AGREEMENT_VERSION (packages/core/
 *           compliance.ts) requires every pro to re-sign before receiving new offers.
 */
import { AGREEMENT_VERSION, BRAND } from "@handled/core";

export const AGREEMENT_TITLE = `${BRAND.legalName} — Independent Contractor Agreement (v${AGREEMENT_VERSION})`;

export const AGREEMENT_SECTIONS: { h: string; p: string }[] = [
  { h: "1. Independent business", p: `You operate your own independent business. Nothing in this agreement makes you an employee, partner or agent of ${BRAND.legalName}. You are responsible for your own taxes; we report payments to you on Form 1099 as required by law.` },
  { h: "2. Your choice of work", p: "Job offers are optional. You may accept or decline any offer, set your own availability, work for other companies and customers, and decide how to perform the work. We describe the result the customer has paid for; you control the methods, tools and helpers you use." },
  { h: "3. Tools, vehicle and costs", p: "You provide your own tools, equipment, vehicle and supplies, and pay your own business expenses, unless a job states that materials are reimbursed." },
  { h: "4. Insurance and licenses", p: "You maintain general liability insurance of at least $1,000,000 per occurrence (and workers' compensation where required for your own workers), and any license your trade requires. You will provide current certificates and notify us immediately if coverage or a license lapses. Offers stop automatically when documents expire." },
  { h: "5. Payment", p: "Each offer shows your payout before you accept. Customers prepay every job. Your payout is approved when the job is completed and its completion photos pass review, and is paid on the weekly payout schedule. You never pay lead fees." },
  { h: "6. Quality and redo", p: `If work you performed is not to the agreed standard, you will return to correct it within ${BRAND.guaranteeDays} days at no additional payout. If a refund is issued for a workmanship issue caused by you, the refunded amount may be deducted from your payout for that job, or from a future payout if already paid.` },
  { h: "7. Customer relationships", p: "For 12 months after you are introduced to a customer through the platform, you will not solicit that customer to book the same services directly with you outside the platform." },
  { h: "8. Conduct and safety", p: "You will follow all laws and safety rules, treat customers' property with care, and consent to a background check before activation. We may stop sending offers for safety, fraud or repeated quality issues." },
  { h: "9. Tax information", p: "You will provide an accurate Form W-9 and keep your legal name, tax classification and address current." },
  { h: "10. Term", p: "Either party may end this agreement at any time with notice. Payouts owed for completed work are paid on the normal schedule." },
];
