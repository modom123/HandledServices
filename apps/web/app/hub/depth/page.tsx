/*
 * FILE    : apps/web/app/hub/depth/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-05_0030 UTC
 * PURPOSE : Mastermind → Pros & recruiting → Depth chart. The pro roster built like a football team: every service is a
 *           position. Each one shows its starter and backups (approved pros cleared to work it, best first), who has
 *           the trade but isn't cleared yet (and why), who's in camp (onboarding) and the prospects in the pipeline.
 *           A position is crossed off once it's filled to its depth (3 deep for the focus services, 2 for the rest).
 *           Open positions are listed first so recruiting knows exactly who to find. ?state=MI|WA charts one region.
 * UPDATED : 2026-11-05_0045 UTC — colors: each slot shows who plays there — green cleared, amber signed but not cleared,
 *           blue in camp (onboarding), purple prospect (recruiting pipeline) — so empty positions show who would fill
 *           them once signed; "Filled if they all sign" shows the roster with the whole pipeline signed.
 * UPDATED : 2026-11-05_0130 UTC — one job's depth chart (?service=<slug>): every pro who could work it, numbered from
 *           starter down the bench in depth order, colored by tier, with why the not-cleared ones can't play yet. Opened
 *           from the job buttons on the Roster (components/DepthJobButtons) or a position's name here.
 * UPDATED : 2026-11-10_0700 UTC — any state (?state= from the coverage map), not only MI / WA; an On-the-map link.
 */
import Link from "next/link";
import { depthChart, depthSummary, getService, type Contractor, type DepthTier, type Position } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { Stat } from "@/components/ui";
import { JobDepth, TIER, depthState, regionsFor } from "@/components/DepthViews";

export const dynamic = "force-dynamic";
export const metadata = { title: "Depth chart" };

const ORD = ["Starter", "2nd", "3rd"];

export default async function DepthChart({ searchParams }: { searchParams: Promise<{ state?: string; show?: string; service?: string }> }) {
  const sp = await searchParams;
  const state = depthState(sp.state); // MI, WA, or any state opened from the coverage map
  const db = adminClient();
  const [{ data: pros }, apps] = await Promise.all([
    db.from("contractors").select("*").in("status", ["approved", "applied", "vetting"]).limit(5000),
    // specialties came with the recruiting intake update; read without them if that hasn't been run
    db.from("contractor_applications").select("id, contact_name, business_name, trades, specialties, stage").in("stage", ["applied", "screened", "interviewing", "interviewed", "invited"]).limit(5000)
      .then((r) => (r.error ? db.from("contractor_applications").select("id, contact_name, business_name, trades, stage").in("stage", ["applied", "screened", "interviewing", "interviewed", "invited"]).limit(5000) : r)),
  ]);
  const prospects = ((apps.error ? [] : apps.data) ?? []).map((a) => ({ id: String(a.id), name: String(a.business_name || a.contact_name), trades: (a.trades ?? []) as string[], specialties: ((a as { specialties?: string[] | null }).specialties ?? null) }));
  const positions = depthChart({ contractors: (pros ?? []) as Contractor[], prospects, state });
  const sum = depthSummary(positions);
  const one = sp.service && getService(sp.service) ? positions.find((p) => p.slug === sp.service) : null;
  if (one) return <JobDepth p={one} state={state} />;
  const open = positions.filter((p) => p.status !== "covered").sort((a, b) => Number(b.focus) - Number(a.focus) || (a.status === "open" ? -1 : 1) - (b.status === "open" ? -1 : 1));
  const showAll = sp.show === "all";
  const q = (extra: Record<string, string>) => `/hub/depth?${new URLSearchParams({ ...(state ? { state } : {}), ...(showAll ? { show: "all" } : {}), ...extra })}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Depth chart</h1>
          <p className="max-w-3xl text-sm text-ink-soft">Every service is a position on the roster. Fill each one with a starter and backups; it’s crossed off when it’s filled to depth: 3 deep for the focus services, 2 for the rest. Only pros cleared to work (trade, insurance, background check, license and coverages) count.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-sm">{regionsFor(state).map(([k, l]) => <Link key={k} href={`/hub/depth${k ? `?state=${k}` : ""}`} className={`rounded-full px-3 py-1 ${state === k ? "bg-brand text-white" : "bg-paper"}`}>{l}</Link>)}<Link href={`/hub/map${state ? `?state=${state}` : ""}`} className="ml-1 text-xs text-brand underline">On the map</Link></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Positions filled" value={`${sum.covered} / ${sum.total}`} hint={`${Math.round((sum.covered / Math.max(1, sum.total)) * 100)}% of the roster`} />
        <Stat label="Thin (need backups)" value={sum.thin} />
        <Stat label="Open (nobody cleared)" value={sum.open} />
        <Stat label="Filled if they all sign" value={`${sum.wouldCover} / ${sum.total}`} hint={`${sum.need} more cleared pros fill every position`} />
      </div>
      <div className="flex flex-wrap gap-2 text-xs">{(Object.keys(TIER) as DepthTier[]).map((k) => <span key={k} className={`rounded-full border px-2 py-0.5 ${TIER[k].cls}`}>{TIER[k].label}</span>)}<span className="rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-rose-900">Open: nobody yet</span></div>

      {open.length > 0 && (
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">Open positions: recruit here</h2><span className="text-xs text-ink-soft">focus services first</span></div>
          <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {open.slice(0, showAll ? open.length : 18).map((p) => (
              <li key={p.slug} className="flex items-center justify-between gap-2 rounded-xl border border-line p-2">
                <span>{p.icon} <Link className="font-bold hover:underline" href={`/hub/depth?service=${p.slug}`}>{p.name}</Link>{p.focus && <span className="ml-1 rounded bg-brand-tint px-1 text-xs text-brand-dark">focus</span>}<span className="block text-xs text-ink-soft">{p.status === "open" ? "no starter" : `${p.depth.length} of ${p.target}`} · need {p.need}{p.inCamp.length ? ` · ${p.inCamp.length} in camp` : ""}{p.prospects.length ? ` · ${p.prospects.length} prospect${p.prospects.length === 1 ? "" : "s"}` : ""}{p.notCleared.length ? ` · ${p.notCleared.length} not cleared` : ""}</span></span>
                <Link className="shrink-0 text-xs underline" href="/hub/leads">Find pros</Link>
              </li>
            ))}
          </ul>
          {open.length > 18 && !showAll && <Link className="mt-2 inline-block text-sm underline" href={q({ show: "all" })}>All {open.length} open and thin positions</Link>}
        </section>
      )}

      {sum.categories.map((c) => (
        <section key={c.id} className="card overflow-x-auto p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 p-4"><h2 className="font-bold">{c.icon} {c.name}</h2><span className="text-sm text-ink-soft">{c.covered}/{c.total} filled{c.open ? ` · ${c.open} open` : ""}{c.thin ? ` · ${c.thin} thin` : ""}</span></div>
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Position</th>{ORD.map((o) => <th key={o} className="p-3">{o}</th>)}<th className="p-3">Bench</th></tr></thead>
            <tbody>{positions.filter((p) => p.category === c.id).map((p) => <Row key={p.slug} p={p} />)}</tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

function Row({ p }: { p: Position }) {
  const covered = p.status === "covered";
  const slots = Math.max(p.target, Math.min(3, p.projected.length));
  const extra = p.projected.slice(3);
  const willFill = !covered && p.projectedStatus === "covered";
  return (
    <tr className={`border-t border-line align-top ${covered ? "bg-emerald-50/40" : ""}`}>
      <td className="p-3">
        <Link href={`/hub/depth?service=${p.slug}`} className={covered ? "text-ink-soft line-through decoration-emerald-600/60" : "font-semibold hover:underline"}>{p.icon} {p.name}</Link>
        {covered ? <span className="ml-2 text-xs font-semibold text-emerald-700">✓ filled</span> : <span className={`ml-2 rounded px-1.5 text-xs ${p.status === "open" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>{p.status === "open" ? "open" : `need ${p.need}`}</span>}
        {p.focus && <span className="ml-1 rounded bg-brand-tint px-1 text-xs text-brand-dark">focus</span>}
        {willFill && <span className="block text-xs text-violet-700">fills once the pipeline signs</span>}
      </td>
      {[0, 1, 2].map((i) => {
        const pl = p.projected[i];
        if (!pl) return <td key={i} className="p-3">{i < slots ? <span className="inline-block rounded-lg border border-dashed border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-800">open</span> : <span className="text-ink-soft">—</span>}</td>;
        return (
          <td key={i} className="p-3">
            <Link href={pl.href} title={TIER[pl.tier].label} className={`block rounded-lg border px-2 py-1 ${TIER[pl.tier].cls}`}><span className="font-semibold">{pl.name}</span><span className="block text-xs opacity-80">{pl.note}</span></Link>
          </td>
        );
      })}
      <td className="p-3">
        {extra.length ? <div className="flex flex-wrap gap-1">{extra.slice(0, 6).map((x) => <Link key={`${x.tier}:${x.id}`} href={x.href} title={`${TIER[x.tier].label} · ${x.note}`} className={`rounded-full border px-2 py-0.5 text-xs ${TIER[x.tier].cls}`}>{x.name}</Link>)}{extra.length > 6 && <span className="text-xs text-ink-soft">+{extra.length - 6}</span>}</div> : <span className="text-xs text-ink-soft">—</span>}
      </td>
    </tr>
  );
}

