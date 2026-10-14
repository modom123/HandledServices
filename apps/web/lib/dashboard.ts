/*
 * FILE    : apps/web/lib/dashboard.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-14_2330 UTC
 * PURPOSE : Shared pieces for the Mastermind Dashboard (app/hub/page.tsx) and its drill-down history pages
 *           (app/hub/stats/[metric]/page.tsx): the metric list, date ranges and small math helpers.
 */

export const METRICS = {
  revenue: { title: "Revenue & take", icon: "💵", blurb: "Completed jobs — what the customer paid, what the pro earned and what we kept." },
  payments: { title: "Payments", icon: "💳", blurb: "Every card payment, deposit and refund recorded against a job." },
  payouts: { title: "Pro payouts", icon: "🧰", blurb: "Money sent (or waiting to be sent) to pros." },
  bookings: { title: "Bookings", icon: "🗂️", blurb: "Jobs created — every request that came in, and where it stands now." },
  open: { title: "Open jobs", icon: "🧭", blurb: "Jobs still in progress right now. Ones without a pro are listed first." },
  cancellations: { title: "Cancellations", icon: "🛟", blurb: "Jobs cancelled, why, and any fee charged." },
  reviews: { title: "Reviews", icon: "⭐", blurb: "Customer ratings and comments." },
  applications: { title: "Pro applications", icon: "🧲", blurb: "Pros who applied to join Handled." },
} as const;
export type MetricKey = keyof typeof METRICS;
export const isMetric = (k: string): k is MetricKey => k in METRICS;

export const RANGES = { "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", ytd: "Year to date", all: "All time" } as const;
export type RangeKey = keyof typeof RANGES;
export const isRange = (k: string | undefined): k is RangeKey => !!k && k in RANGES;

/** Start of a range as an ISO timestamp (null = no lower bound). */
export function rangeStart(r: RangeKey, now = new Date()): string | null {
  if (r === "all") return null;
  if (r === "ytd") return `${now.getUTCFullYear()}-01-01T00:00:00.000Z`;
  const days = { "7d": 7, "30d": 30, "90d": 90 }[r];
  return new Date(now.getTime() - days * 86400000).toISOString();
}

export const sum = (xs: (number | string | null | undefined)[]) => xs.reduce<number>((t, x) => t + Number(x ?? 0), 0);

/** Percent change from `before` to `now`, or null when there's nothing to compare against. */
export const pctChange = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

/** "▲ 12% vs last month" style label. */
export const trendLabel = (pct: number | null, vs: string) => (pct === null ? `no ${vs} to compare` : `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct)}% vs ${vs}`);
