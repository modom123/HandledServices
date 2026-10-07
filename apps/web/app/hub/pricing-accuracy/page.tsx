/*
 * FILE    : apps/web/app/hub/pricing-accuracy/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_1255 UTC
 * PURPOSE : Handled Hub → Pricing accuracy. Per service: did the suggested price match what really
 *           happened on finished jobs (time on site, final price, work added, materials, pro pay per
 *           hour, offer pushback, quote conversion)? Verdict, confidence, the evidence behind it and a
 *           one-click "apply" of the suggested factor (Hub → Market pricing override).
 */
import Link from "next/link";
import { ACCURACY_RULES, MARKET_BOUNDS, type AccuracyRow, type AccuracyVerdict } from "@handled/core";
import { loadPricingAccuracy } from "@/lib/pricing-accuracy";
import { Stat } from "@/components/ui";
import { ApplyFactor } from "@/components/MarketAdmin";

export const dynamic = "force-dynamic";
const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);
const x = (n: number | null) => (n === null ? "—" : `${n.toFixed(2)}×`);

const VERDICT: Record<AccuracyVerdict, [string, string]> = {
  underpriced: ["Underpriced", "bg-rose-100 text-rose-800"],
  overpriced: ["Overpriced", "bg-amber-100 text-amber-800"],
  watch: ["Watch", "bg-sky-100 text-sky-800"],
  on_target: ["On target", "bg-emerald-100 text-emerald-800"],
  no_data: ["Not enough data", "bg-paper text-ink-soft"],
};

function Change({ r }: { r: AccuracyRow }) {
  if (r.change === null || r.verdict === "on_target" || r.verdict === "watch") return <span className="text-ink-soft">—</span>;
  const up = r.change > 1;
  return <span className={`font-semibold ${up ? "text-rose-700" : "text-amber-700"}`}>{up ? "Raise" : "Lower"} {Math.round(Math.abs(r.change - 1) * 100)}%</span>;
}

export default async function PricingAccuracy({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const days = [30, 90, 180, 365].includes(Number((await searchParams).days)) ? Number((await searchParams).days) : 90;
  const { rows } = await loadPricingAccuracy(days);
  const scored = rows.filter((r) => r.verdict !== "no_data");
  const count = (v: AccuracyVerdict) => rows.filter((r) => r.verdict === v).length;
  const jobs = rows.reduce((t, r) => t + r.metrics.jobs, 0);
  const R = ACCURACY_RULES;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pricing accuracy</h1>
          <p className="max-w-3xl text-sm text-ink-soft">Did our suggested price match what really happened? Market pricing learns from what pros do with an offer. This report checks the finished jobs: time on site vs. our estimate, what the job really went for, work added on site, materials, what pros made per hour, refunds and how many saved quotes book. Fix the worst first. Applying a factor sets a manual override in <Link href="/hub/market" className="underline">Market pricing</Link>; clear it there to hand the price back to learning.</p>
        </div>
        <div className="flex gap-1 text-sm">
          {[30, 90, 180, 365].map((d) => <Link key={d} href={`?days=${d}`} className={`rounded-lg px-3 py-1 ${d === days ? "bg-brand text-white" : "btn-ghost"}`}>{d}d</Link>)}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-5">
        <Stat label={`Finished jobs (${days}d)`} value={jobs} hint={`${scored.length} services scored`} />
        <Stat label="Underpriced" value={count("underpriced")} hint="pros lose; they’ll stop taking these" />
        <Stat label="Overpriced" value={count("overpriced")} hint="customers don’t book" />
        <Stat label="Watch" value={count("watch")} hint="price fine, quality flags" />
        <Stat label="On target" value={count("on_target")} hint={`within ±${Math.round(R.tolerance * 100)}%`} />
      </div>

      <div className="space-y-3">
        {scored.map((r) => (
          <div key={r.slug} className="card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold">{r.icon} {r.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${VERDICT[r.verdict][1]}`}>{VERDICT[r.verdict][0]}</span>
                <span className="text-xs text-ink-soft">{r.confidence} confidence · {r.metrics.jobs} jobs · {r.metrics.signals} offers</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Change r={r} />
                <span className="text-ink-soft">factor {r.factor.toFixed(2)}×{r.suggestedFactor !== null ? ` → ${r.suggestedFactor.toFixed(2)}×` : ""}</span>
                {r.suggestedFactor !== null && <ApplyFactor slug={r.slug} factor={r.suggestedFactor} />}
              </div>
            </div>
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-4 lg:grid-cols-8">
              <M label="Final vs suggested" v={x(r.metrics.priceRatio)} />
              <M label="Hours vs estimate" v={x(r.metrics.hoursRatio)} sub={`${r.metrics.timed} timed`} />
              <M label="Pro $/hour" v={r.metrics.proHourly === null ? "—" : `$${r.metrics.proHourly}`} warn={r.metrics.proHourly !== null && r.metrics.proHourly < R.proHourlyFloor} />
              <M label="Work added" v={pct(r.metrics.scopeRate)} sub={`${pct(r.metrics.scopeShare)} of revenue`} />
              <M label="Materials" v={pct(r.metrics.materialsShare)} />
              <M label="Pro pushback" v={pct(r.metrics.pushback)} sub={r.metrics.avgCounter ? `counters +${Math.round((r.metrics.avgCounter - 1) * 100)}%` : undefined} />
              <M label="Quotes → booked" v={pct(r.metrics.quoteConversion)} />
              <M label="Refunds · rating" v={`${pct(r.metrics.refundRate)} · ${r.metrics.avgRating ?? "—"}★`} />
            </div>
            {(r.evidence.length > 0 || r.flags.length > 0) && (
              <ul className="mt-3 space-y-1 text-sm">
                {r.evidence.map((e) => <li key={e.key}><span className={e.ratio >= 1 ? "text-rose-700" : "text-amber-700"}>{e.ratio >= 1 ? "▲" : "▼"}</span> {e.reason} <span className="text-xs text-ink-soft">(points to {e.ratio.toFixed(2)}×, weight {e.weight})</span></li>)}
                {r.flags.map((f) => <li key={f}>⚠️ {f}</li>)}
              </ul>
            )}
          </div>
        ))}
        {!scored.length && <div className="card text-sm text-ink-soft">No service has enough finished jobs yet ({R.minJobs}+ jobs or {R.minSignals}+ offer outcomes in the last {days} days). This fills in as jobs complete.</div>}
      </div>

      {rows.some((r) => r.verdict === "no_data") && (
        <p className="text-xs text-ink-soft">Not enough data yet: {rows.filter((r) => r.verdict === "no_data").map((r) => `${r.icon} ${r.name}${r.metrics.jobs ? ` (${r.metrics.jobs})` : ""}`).join(" · ")}</p>
      )}
      <details className="card text-sm">
        <summary className="cursor-pointer font-semibold">How the verdict is worked out</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">
          <li>Each signal says “the price should be ×r”, weighted by how much data backs it: time on site vs. our estimate (damped, since time isn’t the whole price), the price jobs really went for, work added on site (if {Math.round(R.scopeRate * 100)}%+ of jobs), pro pushback above {Math.round(R.pushbackOk * 100)}% and what counters asked, pro pay under ${R.proHourlyFloor}/hour on site, materials over {Math.round(R.materialsShare * 100)}%, and saved quotes that don’t book (under {Math.round(R.quoteConversionLow * 100)}% while pros accept).</li>
          <li>The weighted average is the suggested change, at most ±{Math.round(R.maxStep * 100)}% at a time and kept within the market bounds ({MARKET_BOUNDS.min}–{MARKET_BOUNDS.max}×). Within ±{Math.round(R.tolerance * 100)}% is on target.</li>
          <li>Refunds ({Math.round(R.refundRate * 100)}%+ of revenue), ratings under {R.ratingFloor}★ and offers nobody takes are flagged but don’t move the price: they’re quality or supply problems.</li>
          <li>Confidence: high at {R.highJobs}+ finished jobs, medium at {R.mediumJobs}+. Only a service-wide factor is suggested; a structural miss (a booking question that doesn’t capture the work) needs a change to the calculator.</li>
        </ul>
      </details>
    </div>
  );
}

function M({ label, v, sub, warn }: { label: string; v: string; sub?: string; warn?: boolean }) {
  return <div className="rounded-lg bg-paper p-2"><div className="text-ink-soft">{label}</div><div className={`text-sm font-semibold ${warn ? "text-rose-700" : ""}`}>{v}</div>{sub && <div className="text-ink-soft">{sub}</div>}</div>;
}
