/*
 * FILE    : apps/web/app/hub/cities/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_1513 UTC
 * PURPOSE : Handled Hub → City scorecard. "Get the model right in Michigan, then replicate": every market
 *           scored against traction / proven / ready-to-replicate gates (90 days, confirmed on the last 30),
 *           its stage and to-do list, the company's pace against the 5-year plan, and ZIP areas where jobs
 *           happen outside any market. Add or pause markets at the bottom.
 * UPDATED : 2026-10-04_1934 UTC — pace against the growth plan where revenue = our take ($10M / $50M / $100M), AI target per year.
 */
import Link from "next/link";
import { CITY_TARGETS, GROWTH_PLAN, LONG_RANGE_GOALS, PLAN_TAKE_RATE } from "@handled/core";
import { loadCityScorecard } from "@/lib/city-scorecard";
import { Stat } from "@/components/ui";
import { MarketForm } from "@/components/MarketsAdmin";
import { City, Meter, pct, short } from "@/components/CityScorecard";

export const dynamic = "force-dynamic";

export default async function CityScorecard() {
  const { cards, pace, launchedAt, outside } = await loadCityScorecard();
  const ready = cards.filter((c) => c.score.readyToReplicate).length;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">City scorecard</h1>
        <p className="max-w-3xl text-sm text-ink-soft">Get the model right in Michigan, then replicate. Each city is scored on the last 90 days (and confirmed on the last 30) against three levels of gates: <b>Traction</b> (it’s alive), <b>Proven</b> (customers come back, quality and margins hold) and <b>Ready to replicate</b> (strong enough to fund and teach the next city). Open a new city only when an existing one is ready to replicate.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label={`Plan year ${pace.year}`} value={pace.plan.phase} hint={`target ${pace.plan.metros} cit${pace.plan.metros === 1 ? "y" : "ies"} · ${launchedAt ? `since first job ${launchedAt.slice(0, 10)}` : "starts at the first completed job"}`} />
        <Stat label="Revenue run-rate (our take, yearly)" value={short(pace.takeRunRate)} hint={`${pct(pace.takePace)} of the year-${pace.year} target (${short(pace.plan.revenue)})`} />
        <Stat label="Bookings run-rate (yearly)" value={short(pace.bookingsRunRate)} hint={`${pct(pace.bookingsPace)} of ${short(pace.plan.bookings)} (target revenue ÷ ${Math.round(PLAN_TAKE_RATE * 100)}% take)`} />
        <Stat label="Cities ready to replicate" value={`${ready} of ${cards.filter((c) => c.market.active).length}`} hint={`all gates pass, held 30 days · AI target ${pct(pace.aiTarget)} this year`} />
      </div>
      <div className="card space-y-3">
        <Meter value={pace.takePace} label={`Revenue (our take) pace vs the year-${pace.year} target`} />
        <Meter value={pace.bookingsPace} label={`Bookings pace vs the year-${pace.year} target`} />
        <p className="text-xs text-ink-soft">Revenue means what we keep (our take), not what customers pay. Run-rates are the last 30 days × 12. Goals: {LONG_RANGE_GOALS.map((g) => `${short(g.revenue)} by year ${g.year}`).join(" · ")} (≈ {short(GROWTH_PLAN[4].bookings)} in bookings in year 5 at a {Math.round(PLAN_TAKE_RATE * 100)}% take). Most of that volume has to come from business accounts: see Customers & B2B and Business leads.</p>
      </div>

      {cards.length === 0 && <div className="card text-sm text-ink-soft">No markets yet. Add Metro Detroit below (ZIPs 480, 481, 482, 483), or run supabase/seed.sql.</div>}
      {cards.map((c) => <City key={c.market.id} c={c} />)}

      {outside.length > 0 && (
        <div className="card text-sm">
          <div className="font-semibold">Jobs outside every city (90 days)</div>
          <p className="text-ink-soft">Completed jobs whose ZIP isn’t in any market. Either a market’s ZIPs need updating, or it’s early demand for a new city.</p>
          <p className="mt-1">{outside.map(([p, n]) => `${p}xx: ${n}`).join(" · ")}</p>
        </div>
      )}

      <div className="card space-y-2">
        <div className="font-semibold">Add a city</div>
        <p className="text-xs text-ink-soft">Name, state and the first 3 digits of its ZIP codes. Jobs, pros and customers are counted by ZIP. A new city starts at Launching; check its gates here weekly.</p>
        <MarketForm />
      </div>

      <details className="card text-sm">
        <summary className="cursor-pointer font-semibold">How the gates are set</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">
          <li><b>Traction:</b> {CITY_TARGETS.traction.jobsPer90}+ jobs in 90 days, {short(CITY_TARGETS.traction.bookingsPerMonth)}+ bookings a month, {pct(CITY_TARGETS.traction.fill)}+ of jobs covered, {CITY_TARGETS.traction.pros}+ active pros.</li>
          <li><b>Proven</b> (the business plan’s key metrics): {short(CITY_TARGETS.proven.bookingsPerMonth)}+ bookings a month, {pct(CITY_TARGETS.proven.fill)}+ covered within a {CITY_TARGETS.proven.hoursToAssign}h median, 2+ pros in every busy trade, {CITY_TARGETS.proven.pros}+ pros, {pct(CITY_TARGETS.proven.repeat)}+ of customers come back, {pct(CITY_TARGETS.proven.planConversion)}+ move to a plan, {CITY_TARGETS.proven.rating}★+, refunds ≤ {pct(CITY_TARGETS.proven.refunds)}, redos ≤ {pct(CITY_TARGETS.proven.redo)}, take ≥ {pct(CITY_TARGETS.proven.takeRate)}, {pct(CITY_TARGETS.proven.aiDriven)}+ AI-driven.</li>
          <li><b>Ready to replicate:</b> {short(CITY_TARGETS.replicate.bookingsPerMonth)}+ bookings a month (the first metro’s year-2 pace), {short(CITY_TARGETS.replicate.netTakePerMonth)}+ net take a month to fund the next city, {pct(CITY_TARGETS.replicate.repeat)}+ come back, {CITY_TARGETS.replicate.pros}+ pros — and every gate still passing in the last 30 days.</li>
          <li>Thresholds live in <code>packages/core/src/city-scorecard.ts</code> (CITY_TARGETS). Related: <Link href="/hub/gaps" className="underline">Supply gaps</Link>, <Link href="/hub/pricing-accuracy" className="underline">Pricing accuracy</Link>, <Link href="/hub/growth" className="underline">Growth</Link>.</li>
        </ul>
      </details>
    </div>
  );
}
