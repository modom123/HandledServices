/*
 * FILE    : packages/core/src/brand.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Single place to rename/rebrand the company. "Handled" is a working name —
 *           run a trademark search before launch and change it here.
 */

// Contact details come from env so going live needs no code change:
//   web: NEXT_PUBLIC_SUPPORT_EMAIL / NEXT_PUBLIC_SUPPORT_PHONE · mobile: EXPO_PUBLIC_SUPPORT_EMAIL / EXPO_PUBLIC_SUPPORT_PHONE
// (each referenced literally so Next.js and Expo can inline them at build time)
let supportEmail = "support@handled.example";
let supportPhone = "(555) 010-2026";
try {
  supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || process.env.EXPO_PUBLIC_SUPPORT_EMAIL || supportEmail;
  supportPhone = process.env.NEXT_PUBLIC_SUPPORT_PHONE || process.env.EXPO_PUBLIC_SUPPORT_PHONE || supportPhone;
} catch {
  // no `process` in this runtime — keep defaults
}
/** True while the placeholder contact details are still in use (flagged on the Hub setup page). */
export const BRAND_PLACEHOLDERS = supportEmail.endsWith(".example") || supportPhone.includes("555");

export const BRAND = {
  name: "Handled",
  legalName: "Handled Services LLC",
  tagline: "Home & business services. Handled.",
  pitch:
    "One app for cleaning, lawn, trees, hauling, repairs and remodels. Upfront prices, vetted pros, and an AI operations team that makes sure it's done right.",
  supportEmail,
  supportPhone,
  serviceArea: "Launch market — set in the ops hub",
  partner: "Built and operated with IEBC — Integrated Efficiency Business Consultants",
  guaranteeDays: 30,
  /** Days we don't schedule work (0 = Sunday … 6 = Saturday). */
  closedWeekdays: [0] as number[],
  /** How far ahead customers can book on the calendar. */
  bookingHorizonDays: 21,
  /** Paid upfront, always — made right with a free redo, a free extra service or a refund. */
  promise: "Pay upfront to lock in your pro. Not right? Free redo or your money back within 30 days.",
} as const;
