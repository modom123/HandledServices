/*
 * FILE    : apps/web/components/CityScorecard.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_1513 UTC
 * PURPOSE : The pieces of Hub → City scorecard: a city card (stage track, money tiles, progress to the
 *           next level, to-do list, every gate with 90-day and last-30-day status), meters and tiles.
 *           Status is always an icon + a word, never color alone.
 */
import { CITY_STAGE_LABEL, LAUNCH_SET_RECOMMENDED, SERVICES, TRADES, money, perMonth, type CityStage, type GateLevel, type GateResult } from "@handled/core";
import type { CityCard } from "@/lib/city-scorecard";
import { LaunchSet, MarketToggle } from "@/components/MarketsAdmin";

const STAGES: CityStage[] = ["launching", "traction", "proven", "replicate"];
export const LEVEL_LABEL: Record<GateLevel, string> = { traction: "Traction", proven: "Proven", replicate: "Ready to replicate" };
export const short = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M` : n >= 1000 ? `$${Math.round(n / 1000)}k` : money(n));
export const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);
const tradeLabel = (id: string) => TRADES.find((t) => t.id === id)?.label ?? id;

/** Status is never color alone: icon + word. */
function GateMark({ state }: { state: GateResult["state"] }) {
  return state === "pass" ? <span className="text-emerald-700">✓ pass</span> : state === "fail" ? <span className="text-rose-700">✗ not yet</span> : <span className="text-ink-soft">– no data</span>;
}

export function Meter({ value, label }: { value: number; label: string }) {
  const w = Math.max(0, Math.min(1, value));
  return (
    <div>
      <div className="flex justify-between text-xs text-ink-soft"><span>{label}</span><span>{Math.round(w * 100)}%</span></div>
      <div className="mt-1 h-2 rounded-full bg-paper" role="meter" aria-valuenow={Math.round(w * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-2 rounded-full bg-brand" style={{ width: `${w * 100}%` }} />
      </div>
    </div>
  );
}

function StageTrack({ stage }: { stage: CityStage }) {
  const at = STAGES.indexOf(stage);
  return (
    <ol className="flex flex-wrap items-center gap-1 text-xs">
      {STAGES.map((s, i) => (
        <li key={s} className={`rounded-full px-2.5 py-1 font-semibold ${i < at ? "bg-brand-tint text-brand-dark" : i === at ? "bg-brand text-white" : "bg-paper text-ink-soft"}`}>{i <= at ? "✓ " : ""}{CITY_STAGE_LABEL[s]}</li>
      ))}
    </ol>
  );
}

export function City({ c }: { c: CityCard }) {
  const { market: m, m90, m30, score } = c;
  const shown = (g: GateResult) => (g.key === "thin" && m90.thinTrades.length ? m90.thinTrades.map(tradeLabel).join(", ") : g.value);
  return (
    <div className={`card space-y-4 ${m.active ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xl font-bold">{m.name}, {m.state} {!m.active && <span className="text-sm font-normal text-ink-soft">(paused)</span>}</div>
          <div className="text-xs text-ink-soft">ZIPs {m.zip_prefixes.map((p) => `${p}xx`).join(", ") || "none set"}</div>
        </div>
        <div className="flex flex-col items-end gap-2"><StageTrack stage={score.stage} /><MarketToggle id={m.id} active={m.active} /></div>
      </div>
      {score.readyToReplicate && <div className="rounded-xl bg-brand-tint p-3 text-sm font-semibold text-brand-dark">✓ Ready to replicate: every gate passes over 90 days and the last 30. This city can fund and teach the next one.</div>}
      {score.stage === "replicate" && !score.readyToReplicate && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">⚠ The 90-day numbers pass, but not all of them held in the last 30 days. Wait until they do.</div>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Bookings / month" value={short(perMonth(m90, m90.bookings))} hint={`last 30d: ${short(m30.bookings)}`} />
        <Tile label="Our take / month" value={short(perMonth(m90, m90.take))} hint={`${pct(m90.bookings ? m90.take / m90.bookings : null)} of bookings`} />
        <Tile label="Net take / month" value={short(perMonth(m90, m90.netTake))} hint="after card fees & refunds" />
        <Tile label="Jobs (90d)" value={String(m90.completedJobs)} hint={`${m90.customers} customers · ${pct(m90.repeatRate)} come back`} />
        <Tile label="Covered by a pro" value={pct(m90.fillRate)} hint={m90.hoursToAssign === null ? "—" : `median ${m90.hoursToAssign.toFixed(1)}h to assign`} />
        <Tile label="Active pros" value={String(m90.activePros)} hint={m90.avgRating ? `${m90.avgRating.toFixed(2)}★ avg (${m90.reviews})` : "no reviews yet"} />
      </div>

      {score.next && <Meter value={score.progress} label={`Gates passed toward ${LEVEL_LABEL[score.next]}`} />}
      {score.todo.length > 0 && (
        <div>
          <div className="text-sm font-semibold">Next: what gets {m.name} to {LEVEL_LABEL[score.next!]}</div>
          <ul className="mt-1 space-y-1 text-sm">{score.todo.map((g) => <li key={g.key}><b>{g.label}</b> — {shown(g)} (target {g.target}). <span className="text-ink-soft">{g.fix}</span></li>)}</ul>
        </div>
      )}

      <details>
        <summary className="cursor-pointer text-sm font-semibold">Open services: {m.launch_services?.length ? `${m.launch_services.length} of ${SERVICES.length} (launch set)` : `all ${SERVICES.length}`}</summary>
        <p className="mt-1 text-xs text-ink-soft">Open a city with a few frequent, simple services so every booking gets a pro fast; everything else shows “coming soon” with a waitlist. Widen the list as the city’s gates pass.</p>
        <div className="mt-2"><LaunchSet id={m.id} current={m.launch_services ?? null} recommended={[...LAUNCH_SET_RECOMMENDED]} services={SERVICES.map((s) => ({ slug: s.slug, name: s.name, icon: s.icon, category: s.category }))} /></div>
      </details>
      <details>
        <summary className="cursor-pointer text-sm font-semibold">All gates</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-ink-soft"><th className="py-1">Level</th><th>Gate</th><th>Target</th><th className="text-right">90 days</th><th className="text-right">Status</th><th className="text-right">Last 30d</th></tr></thead>
            <tbody>
              {score.gates.map((g) => (
                <tr key={g.key} className="border-t border-line">
                  <td className="py-1.5 text-xs text-ink-soft">{LEVEL_LABEL[g.level]}</td><td>{g.label}</td><td className="text-ink-soft">{g.target}</td>
                  <td className="text-right font-medium">{shown(g)}</td>
                  <td className="text-right"><GateMark state={g.state} /></td><td className="text-right">{g.recent ? <GateMark state={g.recent} /> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="rounded-xl bg-paper p-3"><div className="text-xs text-ink-soft">{label}</div><div className="text-lg font-bold">{value}</div>{hint && <div className="text-xs text-ink-soft">{hint}</div>}</div>;
}

