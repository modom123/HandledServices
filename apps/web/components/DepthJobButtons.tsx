/*
 * FILE    : apps/web/components/DepthJobButtons.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-05_0130 UTC
 * PURPOSE : Mastermind → Pros & recruiting → Roster: a button for every job (service), grouped by category and colored
 *           by how filled the position is (green filled · amber thin · red open). Pressing one pulls up that job's depth
 *           chart: every pro who could work it, starter to bench (app/hub/depth?service=…).
 */
import Link from "next/link";
import { CATEGORIES, type Position } from "@handled/core";

const CLS = {
  covered: "border-emerald-300 bg-emerald-50 text-emerald-900",
  thin: "border-amber-300 bg-amber-50 text-amber-900",
  open: "border-rose-300 bg-rose-50 text-rose-900",
} as const;

export function DepthJobButtons({ positions }: { positions: Position[] }) {
  const cats = CATEGORIES.map((c) => ({ ...c, list: positions.filter((p) => p.category === c.id) })).filter((c) => c.list.length);
  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Depth chart by job</h2>
        <div className="flex flex-wrap gap-2 text-xs"><span className={`rounded-full border px-2 py-0.5 ${CLS.covered}`}>filled</span><span className={`rounded-full border px-2 py-0.5 ${CLS.thin}`}>needs backups</span><span className={`rounded-full border px-2 py-0.5 ${CLS.open}`}>open</span><Link href="/hub/depth" className="underline">full depth chart →</Link></div>
      </div>
      <p className="text-sm text-ink-soft">Press a job to see every pro who can work it, from starter to bench.</p>
      <div className="space-y-2">
        {cats.map((c) => (
          <details key={c.id} className="rounded-xl border border-line p-2" open={c.list.some((p) => p.focus)}>
            <summary className="cursor-pointer text-sm font-semibold">{c.icon} {c.name} <span className="font-normal text-ink-soft">· {c.list.filter((p) => p.status === "covered").length}/{c.list.length} filled</span></summary>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {c.list.map((p) => (
                <Link key={p.slug} href={`/hub/depth?service=${p.slug}`} title={`${p.depth.length} cleared of ${p.target}`} className={`rounded-lg border px-2.5 py-1 text-sm hover:shadow-sm ${CLS[p.status]}`}>
                  {p.icon} {p.name} <span className="text-xs opacity-75">{p.depth.length}/{p.target}</span>
                </Link>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
