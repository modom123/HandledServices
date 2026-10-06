/*
 * FILE    : packages/core/src/brand.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0244 UTC — pitch mentions car detailing and grocery & medical deliveries.
 * UPDATED : 2026-10-02_0301 UTC — booking horizon 45 days.
 * UPDATED : 2026-10-02_2229 UTC — googleReviewUrl (NEXT_PUBLIC_ / EXPO_PUBLIC_GOOGLE_REVIEW_URL).
 * UPDATED : 2026-10-06_2105 UTC — real company contact: info@handledsvc.com · (313) 639-9373 (env vars still override).
 * PURPOSE : Single place to rename/rebrand the company. "Handled" is a working name —
 *           run a trademark search before launch and change it here.
 */

// Contact details come from env so going live needs no code change:
//   web: NEXT_PUBLIC_SUPPORT_EMAIL / NEXT_PUBLIC_SUPPORT_PHONE · mobile: EXPO_PUBLIC_SUPPORT_EMAIL / EXPO_PUBLIC_SUPPORT_PHONE
// (each referenced literally so Next.js and Expo can inline them at build time)
let supportEmail = "info@handledsvc.com";
let supportPhone = "(313) 639-9373";
// Google Business Profile → "Ask for reviews" link (https://g.page/r/…/review). Empty = not asked.
let googleReviewUrl = "";
try {
  supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || process.env.EXPO_PUBLIC_SUPPORT_EMAIL || supportEmail;
  supportPhone = process.env.NEXT_PUBLIC_SUPPORT_PHONE || process.env.EXPO_PUBLIC_SUPPORT_PHONE || supportPhone;
  googleReviewUrl = process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL || process.env.EXPO_PUBLIC_GOOGLE_REVIEW_URL || "";
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
    "One app for everything your home or business needs — cleaning, repairs, painting, hauling, lawn and snow, pet care, car detailing, moving and delivery, same-day courier and medical deliveries, events and rides. Upfront prices, vetted pros, and an AI operations team that makes sure it's done right.",
  supportEmail,
  supportPhone,
  /** Where happy customers leave a public Google review. Asked of everyone who rates us (Google forbids asking only happy ones). */
  googleReviewUrl,
  serviceArea: "Launch market — set in the ops hub",
  partner: "Built and operated with IEBC — Integrated Efficiency Business Consultants",
  guaranteeDays: 30,
  /** Days we don't schedule work (0 = Sunday … 6 = Saturday). */
  closedWeekdays: [0] as number[],
  /** How far ahead customers can book on the calendar. */
  bookingHorizonDays: 45, // customers can book up to ~6 weeks out ("within a month" and beyond)
  /** Paid upfront, always — made right with a free redo, a free extra service or a refund. */
  promise: "Pay upfront to lock in your pro. Not right? Free redo or your money back within 30 days.",
} as const;
