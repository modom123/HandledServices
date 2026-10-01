/*
 * FILE    : apps/web/lib/agreement.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2000 UTC
 * UPDATED : 2026-10-01_2124 UTC — v2: Pro Program benefits (pay protection, show-up pay,
 *           instant pay, materials at cost, insurance stipend, guaranteed minimum).
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
  { h: "3. Tools, vehicle and costs", p: "You provide your own tools, equipment, vehicle and supplies, and pay your own business expenses. Where you qualify for materials reimbursement, parts not included in the job price are reimbursed at cost against an itemized receipt, after the customer has paid for them; purchases above the approval limit need our approval first." },
  { h: "4. Insurance and licenses", p: "You maintain general liability insurance of at least $1,000,000 per occurrence (and workers' compensation where required for your own workers), and any license your trade requires. You will provide current certificates and notify us immediately if coverage or a license lapses. Offers stop automatically when documents expire." },
  { h: "5. Payment", p: "Each offer shows your payout before you accept. Customers prepay every job. Your payout is approved when the job is completed and its completion photos pass review, and is paid on the weekly payout schedule. You never pay lead fees." },
  { h: "5A. Pro Program benefits", p: "While you meet the eligibility rules published in your pro portal: (a) pay protection — a refund that is not caused by your workmanship comes out of our share first and reduces your payout only by any amount our share cannot cover; (b) show-up pay — when a customer cancels within 24 hours of the arrival window or you cannot get access, you receive the published show-up amount from the fee we keep; (c) instant pay — you may cash out approved payouts early for the published fee, through a Stripe account in your name; (d) a one-time insurance stipend after the published number of jobs; (e) in the published months, a guaranteed weekly minimum if you stay available and accept the required share of offers, subject to our approval and weekly budget. We may change eligibility rules or amounts going forward with notice in the portal; changes never reduce amounts already earned." },
  { h: "6. Quality and redo", p: `If work you performed is not to the agreed standard, you will return to correct it within ${BRAND.guaranteeDays} days at no additional payout. If a refund is issued for a workmanship issue caused by you, the refunded amount (up to your payout) may be deducted from your payout for that job, or from a future payout if already paid.` },
  { h: "7. Customer relationships", p: "For 12 months after you are introduced to a customer through the platform, you will not solicit that customer to book the same services directly with you outside the platform." },
  { h: "8. Conduct and safety", p: "You will follow all laws and safety rules, treat customers' property with care, and consent to a background check before activation. We may stop sending offers for safety, fraud or repeated quality issues." },
  { h: "9. Tax information", p: "You will provide an accurate Form W-9 and keep your legal name, tax classification and address current." },
  { h: "10. Term", p: "Either party may end this agreement at any time with notice. Payouts owed for completed work are paid on the normal schedule." },
];
