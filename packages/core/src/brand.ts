/*
 * FILE    : packages/core/src/brand.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Single place to rename/rebrand the company. "Handled" is a working name —
 *           run a trademark search before launch and change it here.
 */

export const BRAND = {
  name: "Handled",
  legalName: "Handled Services LLC",
  tagline: "Home & business services. Handled.",
  pitch:
    "One app for cleaning, lawn, trees, hauling, repairs and remodels. Upfront prices, vetted pros, and an AI operations team that makes sure it's done right.",
  supportEmail: "support@handled.example",
  supportPhone: "(555) 010-2026",
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
