/*
 * FILE    : apps/web/components/DashboardSwitch.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-20_0415 UTC
 * PURPOSE : One Dashboard, two views (owner: combine the dashboards so there's no bloat): ☀️ Today (what needs attention
 *           now: the AI brief, alerts, today's schedule, queues — /hub/briefing) and 📊 This month (stats, trends and
 *           insights — /hub). Both pages keep their addresses; this switch sits at the top of each.
 */
import Link from "next/link";

export function DashboardSwitch({ on }: { on: "today" | "month" }) {
  const tab = (href: string, label: string, active: boolean) => (
    <Link href={href} aria-current={active ? "page" : undefined} className={`rounded-lg px-4 py-1.5 text-sm ${active ? "bg-brand font-semibold text-white" : "text-ink-soft hover:text-ink"}`}>{label}</Link>
  );
  return (
    <nav className="inline-flex rounded-xl border border-line bg-white p-1" aria-label="Dashboard view">
      {tab("/hub/briefing", "☀️ Today", on === "today")}
      {tab("/hub", "📊 This month", on === "month")}
    </nav>
  );
}
