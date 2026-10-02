/*
 * FILE    : apps/web/lib/service-agreement.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2030 UTC
 * PURPOSE : Customer Service Agreement (SERVICE_AGREEMENT_VERSION), printed on every invoice
 *           and accepted at booking. TEMPLATE — have a lawyer review it for consumer-
 *           protection, home-improvement and licensing rules in each state you operate in.
 */
import { BRAND, LATE_CANCEL_FEE, SERVICE_AGREEMENT_VERSION } from "@handled/core";

export const SERVICE_AGREEMENT_TITLE = `${BRAND.legalName} — Service Agreement (v${SERVICE_AGREEMENT_VERSION})`;

export const SERVICE_AGREEMENT: { h: string; p: string }[] = [
  { h: "1. Who you're contracting with", p: `You are contracting with ${BRAND.legalName} ("${BRAND.name}", "we"). We price, schedule, manage and guarantee your job. The work is performed by an independent, insured, background-checked service business selected and quality-checked by us ("your pro"). You pay us; we pay your pro after the work is complete and has passed our quality check. Please don't pay your pro directly.` },
  { h: "2. Scope of work", p: "We will perform the work described on this invoice, priced from the details and photos you provided. If conditions on site differ materially (more items or area, hidden damage, unsafe conditions, access problems), your pro will pause and we will send you a change order with a new price. Additional work is done only after you approve and pay for it. Anything not listed is not included." },
  { h: "3. Price and payment", p: "The full price is paid upfront to schedule the work. Prices include labor and the materials listed; applicable taxes are shown on the invoice. If your job needs parts or materials that aren't included, they are billed at cost (no markup) against the receipt, and we tell you before your card is charged; larger purchases need your OK first. Recurring plans are charged to your card on file before each visit, and you can cancel a plan any time before the next charge. Site visits for estimates are free; a firm quote is valid for 14 days." },
  { h: "4. Scheduling and access", p: `Your pro arrives within the booked window. Please provide access, working utilities and clear work areas, and secure pets. If your pro can't get access or you're unavailable, we may keep a $${LATE_CANCEL_FEE} trip fee and refund the rest or reschedule.` },
  { h: "5. Cancelling or rescheduling", p: `Reschedule or cancel free of charge up to 24 hours before your arrival window for a full refund. Within 24 hours we keep a $${LATE_CANCEL_FEE} late-cancellation fee and refund the balance. Remodel, HVAC and other quoted projects follow the cancellation terms in their quote once materials are ordered.` },
  { h: "6. Our make-it-right guarantee", p: `If anything isn't right, tell us within ${BRAND.guaranteeDays} days with photos. We will send your pro back to fix it at no cost, provide a complimentary service, or refund all or part of the price, whichever fairly resolves the issue. Refunds go back to the original payment method.` },
  { h: "7. Photos and messages", p: "Your pro takes before and after photos for our quality check. We use them for quality control and support only, and never publish them without your permission. You agree to receive texts and emails about your jobs; reply STOP to opt out of texts." },
  { h: "8. Property damage", p: "Every pro carries general liability insurance. Report any damage within 72 hours with photos; we coordinate the claim with your pro and their insurer. To the extent the law allows, our total liability is limited to the amount you paid for the job, plus any amount recovered from insurance." },
  { h: "9. Licensed work and safety", p: "Plumbing, electrical, HVAC, painting and remodeling work is performed by licensed pros, with permits where required. Homes built before 1978 get lead-safe (EPA RRP) work practices for painting and remodeling. Transportation is provided by licensed, insured passenger carriers that we book on your behalf; the driver may refuse unsafe or unlawful conduct, and riders under 21 may not have alcohol aboard. We may decline or stop work involving hazards such as asbestos, mold, hazardous waste or unsafe structures, and refund the unperformed portion." },
  { h: "10. Booking through us", p: "Please book future work with the pros you meet through us, so this agreement, our insurance requirements and our guarantee continue to protect you." },
  { h: "11. Disputes and governing law", p: `Please contact us first at ${BRAND.supportEmail} or ${BRAND.supportPhone}; most issues are resolved within a business day. This agreement is governed by the laws of the state where the work is performed.` },
  { h: "12. Entire agreement", p: "This invoice and these terms are the entire agreement for this job. Accepting them online when you book is your signature." },
];
