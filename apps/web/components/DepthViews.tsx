/*
 * FILE    : apps/web/components/DepthViews.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-05_0130 UTC
 * PURPOSE : Depth chart pieces shared by Mastermind → Depth chart (app/hub/depth): the tier colors (green cleared, amber
 *           signed but not cleared, blue in camp, purple prospect), the region switch, and JobDepth — one job's full
 *           depth chart, everyone who could work it numbered from starter down the bench.
 * UPDATED : 2026-11-10_0700 UTC — any state from the coverage map (depthState / regionsFor) and an On-the-map link.
 */
import Link from "next/link";
import { getService, type DepthTier, type Position } from "@handled/core";

export const REGIONS = [["", "All"], ["MI", "Michigan"], ["WA", "Washington"]] as const;

/** Any US state code (from the coverage map) or "" for all. */
export const depthState = (v: string | undefined) => (/^[A-Za-z]{2}$/.test(v ?? "") ? v!.toUpperCase() : "");
/** The region switch: All / Michigan / Washington, plus the state that was opened from the map. */
export const regionsFor = (state: string): readonly (readonly [string, string])[] => (state && !REGIONS.some(([k]) => k === state) ? [...REGIONS, [state, state] as const] : REGIONS);

export const TIER: Record<DepthTier, { label: string; cls: string }> = {
  cleared: { label: "Cleared to play", cls: "border-emerald-300 bg-emerald-50 text-emerald-900" },
  not_cleared: { label: "Signed, not cleared", cls: "border-amber-300 bg-amber-50 text-amber-900" },
  in_camp: { label: "In camp (onboarding)", cls: "border-sky-300 bg-sky-50 text-sky-900" },
  prospect: { label: "Prospect (recruiting)", cls: "border-violet-300 bg-violet-50 text-violet-900" },
};

const ROLE = (i: number, target: number) => (i === 0 ? "Starter" : i < target ? `Backup ${i}` : "Bench");

/** One job's full depth chart: everyone who could work it, in depth order. */
export function JobDepth({ p, state }: { p: Position; state: string }) {
  const svc = getService(p.slug)!;
  const covered = p.status === "covered";
  const counts = (Object.keys(TIER) as DepthTier[]).map((k) => [k, p.projected.filter((x) => x.tier === k).length] as const);
  return (
    <div className="max-w-4xl space-y-5">
      <Link href={`/hub/depth${state ? `?state=${state}` : ""}`} className="text-sm text-brand">← All positions</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{p.icon} {p.name} <span className="text-base font-normal text-ink-soft">depth chart</span></h1>
          <p className="text-sm text-ink-soft">{covered ? `✓ Filled: ${p.depth.length} cleared (needs ${p.target})` : p.status === "open" ? `Open: nobody cleared yet (needs ${p.target})` : `Thin: ${p.depth.length} of ${p.target} cleared — need ${p.need} more`}{p.projectedStatus === "covered" && !covered ? " · fills once the pipeline signs" : ""} · trades: {svc.trades.join(", ")}{svc.licensed ? " · license required" : ""}{svc.insuranceOptional ? " · insurance optional" : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-sm">{regionsFor(state).map(([k, l]) => <Link key={k} href={`/hub/depth?service=${p.slug}${k ? `&state=${k}` : ""}`} className={`rounded-full px-3 py-1 ${state === k ? "bg-brand text-white" : "bg-paper"}`}>{l}</Link>)}<Link href={`/hub/map?service=${p.slug}${state ? `&state=${state}` : ""}`} className="ml-1 text-xs text-brand underline">On the map</Link></div>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">{counts.map(([k, n]) => <span key={k} className={`rounded-full border px-2 py-0.5 ${TIER[k].cls}`}>{TIER[k].label}: {n}</span>)}</div>
      {!p.projected.length ? (
        <div className="card text-sm">Nobody on file can work this job yet. <Link className="underline" href="/hub/leads">Find pros →</Link></div>
      ) : (
        <ol className="space-y-2">
          {p.projected.map((x, i) => (
            <li key={`${x.tier}:${x.id}`} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 ${TIER[x.tier].cls}`}>
              <div className="flex items-center gap-3">
                <span className="w-8 text-center text-lg font-bold">{i + 1}</span>
                <div><Link href={x.href} className="font-semibold underline">{x.name}</Link><div className="text-xs opacity-80">{x.note}</div></div>
              </div>
              <div className="text-right text-xs"><div className="font-semibold">{x.tier === "cleared" ? ROLE(i, p.target) : TIER[x.tier].label}</div>{x.tier !== "cleared" && <div className="opacity-80">{x.tier === "not_cleared" ? "fix the item to play" : x.tier === "in_camp" ? "finish onboarding to play" : "sign them up to play"}</div>}</div>
            </li>
          ))}
        </ol>
      )}
      {p.need > 0 && <p className="text-sm text-ink-soft">To fill this position: {p.need} more cleared pro{p.need === 1 ? "" : "s"}. {p.notCleared.length ? "Start with the amber ones — they only need one item fixed." : p.inCamp.length ? "Help the blue ones finish onboarding." : p.prospects.length ? "Reach out to the purple prospects." : ""} <Link className="underline" href="/hub/leads">Find pros →</Link></p>}
    </div>
  );
}
