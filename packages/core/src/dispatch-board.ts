/*
 * FILE    : packages/core/src/dispatch-board.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-11_2242 UTC
 * PURPOSE : Rules behind Hub → Dispatch and Hub → Payments (pure, tested):
 *             hoursUntilStart — hours until the job's time window opens, in the job's own time zone
 *             paymentState    — paid / deposit + balance due / unpaid / on account / refunded / free visit, with a tone
 *             dispatchFlags   — what needs a dispatcher: no pro (red inside 6 hours), unpaid, balance due, no backups
 *                               within 3 days, pro running late, offers out with nobody answering
 */
import { localDate, localHour, timeZoneForZip } from "./roster.ts";

/** When each time window opens (local hour). "Flexible" counts from the start of the day. */
export const WINDOW_OPENS: Record<string, number> = { morning: 8, midday: 11, afternoon: 14, flexible: 8 };

export interface BoardJobInput {
  scheduled_date: string | null;
  time_window: string | null;
  zip: string | null;
  status: string;
  contractor_id: string | null;
  price_final: number | null;
  paid_at: string | null;
  deposit_paid_at?: string | null;
  billed_on_terms?: boolean | null;
  amount_paid?: number | null;
  amount_refunded?: number | null;
  remedy?: string | null;
}

export type Tone = "red" | "amber" | "green" | "slate" | "brand";
export interface BoardFlag { key: string; label: string; tone: "red" | "amber" }

const DONE = new Set(["completed", "cancelled", "qa_review"]);
const BEFORE_PRO = new Set(["requested", "quoted", "scheduled", "dispatched", "site_visit"]);

/** Hours from now until the job's window opens (negative once it has started); null without a date. */
export function hoursUntilStart(j: Pick<BoardJobInput, "scheduled_date" | "time_window" | "zip">, now = new Date()): number | null {
  if (!j.scheduled_date) return null;
  const tz = timeZoneForZip(j.zip);
  const today = localDate(now, tz);
  const days = Math.round((new Date(`${j.scheduled_date}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86400000);
  const minute = now.getUTCMinutes() / 60; // US time zones are whole hours apart
  return days * 24 + (WINDOW_OPENS[j.time_window ?? "flexible"] ?? 8) - (localHour(now, tz) + minute);
}

/** Where the customer's money stands for one job. */
export function paymentState(j: BoardJobInput): { key: string; label: string; tone: Tone } {
  const refunded = Number(j.amount_refunded ?? 0);
  if (j.status === "cancelled" && !j.paid_at && !j.deposit_paid_at) return { key: "none", label: "Cancelled", tone: "slate" };
  if (j.remedy) return { key: "remedy", label: "Free (make-it-right)", tone: "slate" };
  if (j.billed_on_terms) return { key: "terms", label: "On account (monthly invoice)", tone: "brand" };
  if (j.paid_at && refunded > 0) return { key: "refunded", label: `Paid · $${refunded.toFixed(0)} refunded`, tone: "amber" };
  if (j.paid_at) return { key: "paid", label: "Paid", tone: "green" };
  if (j.deposit_paid_at) return { key: "balance", label: "Deposit paid · balance due", tone: "amber" };
  if (j.status === "site_visit") return { key: "visit", label: "Free visit — no charge yet", tone: "slate" };
  if (!Number(j.price_final ?? 0)) return { key: "unpriced", label: "No price yet", tone: "slate" };
  return { key: "unpaid", label: "Unpaid", tone: "red" };
}

/** What needs a dispatcher's attention on this job, most urgent first. */
export function dispatchFlags(j: BoardJobInput, ctx: { standby: number; pendingOffers: number; now?: Date }): BoardFlag[] {
  if (DONE.has(j.status)) return [];
  const now = ctx.now ?? new Date();
  const h = hoursUntilStart(j, now);
  const flags: BoardFlag[] = [];
  if (!j.contractor_id && BEFORE_PRO.has(j.status) && j.status !== "requested") {
    if (h !== null && h < 6) flags.push({ key: "no_pro_soon", label: h < 0 ? "Started — no pro" : `No pro · starts in ${Math.max(0, Math.round(h))}h`, tone: "red" });
    else flags.push({ key: "no_pro", label: ctx.pendingOffers ? `No pro yet · ${ctx.pendingOffers} offer${ctx.pendingOffers === 1 ? "" : "s"} out` : "No pro yet", tone: "amber" });
  }
  const pay = paymentState(j).key;
  if (pay === "unpaid") flags.push({ key: "unpaid", label: "Unpaid — not dispatched until paid", tone: h !== null && h < 24 ? "red" : "amber" });
  if (pay === "balance") flags.push({ key: "balance", label: "Balance due", tone: "amber" });
  if (j.contractor_id && ctx.standby === 0 && h !== null && h < 72 && h > -3) flags.push({ key: "no_backups", label: "No backups confirmed", tone: "amber" });
  if (j.contractor_id && j.status === "assigned" && h !== null && h < -0.5) flags.push({ key: "late", label: `Pro not started · ${Math.round(-h * 60)} min into the window`, tone: "red" });
  return flags.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "red" ? -1 : 1));
}
