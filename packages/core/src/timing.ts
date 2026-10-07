/*
 * FILE    : packages/core/src/timing.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_0301 UTC
 * PURPOSE : What the customer told us about timing and money when they asked for the job:
 *             URGENCY / neededBy()   — "As soon as possible" (same day if a pro is on call) …
 *                                      "Within 2 weeks" … "I'm flexible"; the last day they need it
 *             urgencyPriority()      — dispatch priority (ASAP → urgent: more pros, shorter offers)
 *             budgetFit()            — their budget vs our price: fits / a little over / well over
 *             deadlineRisk()         — not done yet and the customer's date is close or passed
 * UPDATED : 2026-10-07_1900 UTC — quick choices read Today / Next week / In 2 weeks / Within a month / I'm flexible (then pick the exact date and time on the calendar).
 */
import { BRAND } from "./brand.ts";
import { localDate } from "./roster.ts";

export type Urgency = "asap" | "this_week" | "two_weeks" | "month" | "flexible";

export const URGENCY: { id: Urgency; label: string; hint: string; days: number }[] = [
  { id: "asap", label: "Today", hint: "Today if a pro is free, or tomorrow. Priority fee applies within 48 hours.", days: 1 },
  { id: "this_week", label: "Next week", hint: "Within 7 days", days: 7 },
  { id: "two_weeks", label: "In 2 weeks", hint: "Within 14 days", days: 14 },
  { id: "month", label: "Within a month", hint: "Within 30 days", days: 30 },
  { id: "flexible", label: "I'm flexible", hint: "Any open date — often the best availability", days: BRAND.bookingHorizonDays },
];

export const URGENCY_LABEL = Object.fromEntries(URGENCY.map((u) => [u.id, u.label])) as Record<Urgency, string>;

const addDays = (date: string, n: number) => new Date(new Date(`${date}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

/** Last day the customer needs it done (YYYY-MM-DD), counted from `from` (local today). */
export function neededBy(u: Urgency, from = localDate()): string {
  return addDays(from, URGENCY.find((x) => x.id === u)?.days ?? BRAND.bookingHorizonDays);
}

export function urgencyPriority(u: Urgency | null | undefined, rush: boolean): "urgent" | "high" | "normal" {
  if (u === "asap") return "urgent";
  if (rush || u === "this_week") return "high";
  return "normal";
}

export type BudgetFit = { status: "none" | "fits" | "close" | "over"; gap: number; message: string };

/** Their budget vs our upfront price. "close" = within 15% over. */
export function budgetFit(budget: number | null | undefined, price: number): BudgetFit {
  if (!budget || !(budget > 0) || !(price > 0)) return { status: "none", gap: 0, message: "" };
  const gap = Math.round((price - budget) * 100) / 100;
  if (gap <= 0) return { status: "fits", gap, message: "Fits your budget." };
  const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  if (gap <= budget * 0.15) return { status: "close", gap, message: `${fmt(gap)} over your budget. A flexible date (no priority fee) or a slightly smaller scope usually closes the gap.` };
  return { status: "over", gap, message: `${fmt(gap)} over your ${fmt(budget)} budget. Try a smaller scope, a recurring plan, or send it anyway — we'll call you with options.` };
}

/** Open job vs the customer's last acceptable day. */
export function deadlineRisk(job: { needed_by?: string | null; status: string }, today = localDate()): "late" | "due" | null {
  if (!job.needed_by || ["completed", "cancelled"].includes(job.status)) return null;
  if (job.needed_by < today) return "late";
  if (job.needed_by <= addDays(today, 1)) return "due";
  return null;
}
