/*
 * FILE    : apps/web/components/DepthJobButtons.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-05_0130 UTC
 * PURPOSE : Mastermind → Pros & recruiting → Roster: a button for every job (service), grouped by category and colored
 *           by how filled the position is (green filled · amber thin · red open). Pressing one pulls up that job's depth
 *           chart: every pro who could work it, starter to bench (app/hub/depth?service=…).
 * UPDATED : 2026-11-17_2030 UTC — no more giant list of every service (owner): "Services we can offer now" shows only the
 *           services with at least one cleared pro (green = has backups, amber = one pro, no backup), with counts; every
 *           other service is in a dropdown (by category, with its status) that opens its depth chart. Services nobody can
 *           do yet are a count with a link to Supply gaps.
 */
import Link from "next/link";
import { CATEGORIES, type Position } from "@handled/core";
import { ServiceJump } from "./ServiceJump";

const CLS = {
  covered: "border-emerald-300 bg-emerald-50 text-emerald-900",
  thin: "border-amber-300 bg-amber-50 text-amber-900",
} as const;

export function DepthJobButtons({ positions }: { positions: Position[] }) {
  const offer = positions.filter((p) => p.status !== "open").sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === "covered" ? -1 : 1));
  const backed = offer.filter((p) => p.status === "covered").length;
  const none = positions.length - offer.length;
  const options = CATEGORIES.map((c) => ({
    label: `${c.icon} ${c.name}`,
    items: positions.filter((p) => p.category === c.id).map((p) => ({ slug: p.slug, label: `${p.status === "covered" ? "✓" : p.status === "thin" ? "⚠" : "✗"} ${p.name} · ${p.depth.length} pro${p.depth.length === 1 ? "" : "s"}` })),
  })).filter((g) => g.items.length);
  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Services we can offer now</h2>
          <p className="text-sm text-ink-soft"><b className="text-ink">{offer.length}</b> of {positions.length} services have at least one cleared pro · <span className="text-emerald-800">{backed} with backups</span> · <span className="text-amber-800">{offer.length - backed} with one pro, no backup</span></p>
        </div>
        <ServiceJump groups={options} />
      </div>
      {offer.length ? (
        <div className="flex flex-wrap gap-1.5">
          {offer.map((p) => (
            <Link key={p.slug} href={`/hub/depth?service=${p.slug}`} title={`${p.depth.length} cleared of ${p.target} wanted — see who`} className={`rounded-lg border px-2.5 py-1 text-sm hover:shadow-sm ${CLS[p.status as "covered" | "thin"]}`}>
              {p.icon} {p.name} <span className="text-xs opacity-75">{p.depth.length}</span>
            </Link>
          ))}
        </div>
      ) : <p className="rounded-lg bg-paper p-3 text-sm text-ink-soft">No service has a cleared pro yet — approve pros in Recruiting → Onboarding and they appear here.</p>}
      {none > 0 && <p className="text-xs text-ink-soft">{none} more service{none === 1 ? "" : "s"} have no pro yet — pick one in the menu above, or see <Link href="/hub/gaps" className="underline">Supply gaps</Link> for which to recruit for first.</p>}
    </section>
  );
}
