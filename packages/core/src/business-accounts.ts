/*
 * FILE    : packages/core/src/business-accounts.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-04_1934 UTC
 * PURPOSE : Business accounts (property managers, brokerages, stagers, stores, storage facilities):
 *             • Invoicing on terms (Net 15/30/45) is offered CASE BY CASE: every account starts on
 *               prepay (card at booking, like everyone else); staff can approve terms with a credit
 *               limit. A job goes on the account's invoice only while the account is approved, not on
 *               hold, and the open balance plus this job stays within the limit — otherwise it's prepay.
 *             • Overdue invoices put terms on hold automatically (prepay again until paid).
 *             • Pilot offer: a % off the first N jobs to win the account, always from our share.
 *             • Priority: account jobs dispatch ahead, with a response-time promise (SLA).
 *             • Dedicated pros: the account's favorite pros get first offer on its jobs.
 *           Pure and deterministic; the web layer reads/writes the tables.
 */
import { capDiscount } from "./growth.ts";

export type BillingMode = "prepay" | "terms";
export const TERMS_DAYS = [15, 30, 45] as const;

export const BUSINESS_TERMS = {
  /** Default credit limit suggested when staff approves terms (they can change it). */
  defaultCreditLimit: 2500,
  /** Days past due before terms go on hold (account back to prepay until paid). */
  holdAfterDaysOverdue: 10,
  /** Reminder schedule relative to the due date (negative = before). */
  reminders: [-3, 1, 7, 14] as const,
  /** Pilot offers are capped so a pilot never gives away the job. */
  maxPilotPct: 30,
  maxPilotJobs: 5,
  /** Response-time promise for priority accounts (hours to a confirmed pro). */
  prioritySlaHours: 4,
  /** How long an account's dedicated pros see a job before everyone else. */
  dedicatedFirstLookHours: 2,
} as const;

export interface BusinessAccountTerms {
  billing_mode: BillingMode;
  terms_days: number;
  credit_limit: number;
  terms_hold: boolean;
  pilot_discount_pct: number;
  pilot_jobs_left: number;
  priority: boolean;
}

/** Does this job go on the account's invoice (true) or is it paid at booking (false)? With the reason. */
export function termsDecision(a: Pick<BusinessAccountTerms, "billing_mode" | "credit_limit" | "terms_hold">, openBalance: number, price: number): { onTerms: boolean; reason: string } {
  if (a.billing_mode !== "terms") return { onTerms: false, reason: "Prepay account: pay at booking. Ask us about invoicing." };
  if (a.terms_hold) return { onTerms: false, reason: "Invoicing is on hold until the overdue invoice is paid. Pay at booking for now." };
  if (openBalance + price > Number(a.credit_limit)) return { onTerms: false, reason: `This job would take the account over its $${Math.round(Number(a.credit_limit)).toLocaleString("en-US")} credit limit. Pay at booking, or pay the open invoice first.` };
  return { onTerms: true, reason: "Billed to your account." };
}

/** Pilot discount for this job (0 when none left). Always from our share, never the pro's pay. */
export function pilotDiscount(a: Pick<BusinessAccountTerms, "pilot_discount_pct" | "pilot_jobs_left">, listPrice: number, payout: number): number {
  if (!(a.pilot_jobs_left > 0) || !(a.pilot_discount_pct > 0)) return 0;
  const pct = Math.min(BUSINESS_TERMS.maxPilotPct, a.pilot_discount_pct) / 100;
  return capDiscount(listPrice, payout, listPrice * pct);
}

export const addDaysIso = (iso: string, days: number) => new Date(new Date(`${iso.slice(0, 10)}T12:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);

/** Invoice period: the calendar month before `on` (invoices go out on the 1st). */
export function invoicePeriod(on = new Date()): { start: string; end: string; issue: string } {
  const y = on.getUTCFullYear(), m = on.getUTCMonth();
  const start = new Date(Date.UTC(m === 0 ? y - 1 : y, (m + 11) % 12, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { start, end, issue: on.toISOString().slice(0, 10) };
}

/** Days past due (0 if not yet due). */
export const daysOverdue = (due: string, today = new Date()) => Math.max(0, Math.floor((today.getTime() - new Date(`${due}T23:59:59Z`).getTime()) / 86400000) + 1);

/** Which reminder (if any) is due today for an open invoice; null when none. */
export function invoiceReminderDue(due: string, sent: number, today = new Date()): number | null {
  const d = Math.floor((today.getTime() - new Date(`${due}T12:00:00Z`).getTime()) / 86400000);
  const next = BUSINESS_TERMS.reminders[sent];
  return next !== undefined && d >= next ? next : null;
}

export const invoiceNumber = (accountSeq: number, period: { start: string }) => `INV-${period.start.slice(0, 7).replace("-", "")}-${String(accountSeq).padStart(4, "0")}`;
