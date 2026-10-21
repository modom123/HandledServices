/*
 * FILE    : apps/web/components/ViewSwitch.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-15_0200 UTC
 * PURPOSE : The two-way switch at the top of a merged Mastermind page (Roster | Health & 1099, Our bids | Find federal,
 *           Agents | IEBC Workforce, Market pricing | Accuracy check). Plain links (?view=…), so it works without JS
 *           and each view has its own URL.
 */
import Link from "next/link";

export type View = readonly [key: string, label: string];

export function ViewSwitch({ base, views, current }: { base: string; views: readonly View[]; current: string }) {
  return (
    <nav className="mb-6 inline-flex rounded-xl border border-line bg-white p-1" aria-label="View">
      {views.map(([key, label], i) => (
        <Link key={key} href={i === 0 ? base : `${base}?view=${key}`} aria-current={key === current ? "page" : undefined}
          className={`rounded-lg px-4 py-1.5 text-sm ${key === current ? "bg-brand font-semibold text-white" : "text-ink-soft hover:text-ink"}`}>{label}</Link>
      ))}
    </nav>
  );
}

/** The chosen view, or the first one when ?view= is missing or unknown. */
export const pickView = (views: readonly View[], v: string | undefined) => (views.some(([k]) => k === v) ? v! : views[0][0]);
