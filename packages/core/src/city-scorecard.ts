/*
 * FILE    : packages/core/src/city-scorecard.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_1513 UTC
 * PURPOSE : The city scorecard — "get the model right in Michigan, then replicate." Each market is scored
 *           on the numbers that prove the model works there (demand, liquidity, supply, retention,
 *           quality, economics, automation) against gates in three levels:
 *             traction   — the city is alive (real volume, jobs get covered)
 *             proven     — the model works (customers come back, quality and margins hold)
 *             replicate  — strong enough to fund and copy into the next city (the business plan's
 *                          metro playbook: open a new metro only when existing ones can fund it)
 *           A market's stage is the highest level whose gates all pass; "ready to replicate" also
 *           needs them to hold in the last 30 days, not just the 90-day window. Pure and deterministic.
 *           The growth plan (revenue = our take, cities and AI targets per year) is here too, for the
 *           "on pace" line. Thresholds come from docs/BUSINESS_PLAN (key metrics + growth plan).
 * UPDATED : 2026-10-04_1934 UTC — growth plan to $100M: revenue means our take ($10M year 5, $50M year 7, $100M year 10),
 *           city counts by phase, AI-driven target rising to 95%.
 */

export type GateLevel = "traction" | "proven" | "replicate";
export type CityStage = "launching" | GateLevel;

/** What we measure per market for a window (null = no data yet). Money in dollars, rates 0–1. */
export interface CityMetrics {
  days: number;
  completedJobs: number;
  /** What customers paid for completed jobs (GMV), after discounts. */
  bookings: number;
  /** Our take on those jobs (price − pro payout). */
  take: number;
  /** Take after card fees and refunds. */
  netTake: number;
  refunded: number;
  /** Paid jobs that got a pro ÷ paid jobs that needed one (cancelled-by-customer excluded). */
  fillRate: number | null;
  /** Median hours from the first offer to a pro accepting. */
  hoursToAssign: number | null;
  /** Approved pros based in the market. */
  activePros: number;
  /** Trades with real demand (≥ 5 jobs) that have fewer than 2 active pros. */
  thinTrades: string[];
  customers: number;
  /** Customers with 2+ completed jobs, or a recurring plan, ÷ customers. */
  repeatRate: number | null;
  /** One-time customers who started a recurring plan ÷ one-time customers. */
  planConversion: number | null;
  avgRating: number | null;
  reviews: number;
  /** Jobs that needed a redo or complimentary visit ÷ completed jobs. */
  redoRate: number | null;
  /** Share of completed jobs with zero human touches. */
  aiDrivenRate: number | null;
}

export interface CityGate {
  key: string;
  level: GateLevel;
  label: string;
  /** Plain-language target, e.g. "≥ 90%". */
  target: string;
  test: (m: CityMetrics) => boolean | null;
  value: (m: CityMetrics) => string;
  /** What to do when it fails. */
  fix: string;
}

const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);
const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
/** Monthly run-rate from a window. */
export const perMonth = (m: Pick<CityMetrics, "days">, total: number) => (m.days > 0 ? (total / m.days) * 30.4 : 0);
const share = (a: number, b: number) => (b > 0 ? a / b : null);
const atLeast = (v: number | null, t: number) => (v === null ? null : v >= t);
const atMost = (v: number | null, t: number) => (v === null ? null : v <= t);

/** Gate thresholds, in one place (Hub shows them; tests pin them). */
export const CITY_TARGETS = {
  traction: { jobsPer90: 60, bookingsPerMonth: 15_000, fill: 0.8, pros: 10 },
  proven: { bookingsPerMonth: 60_000, fill: 0.9, hoursToAssign: 2, repeat: 0.3, planConversion: 0.2, rating: 4.8, refunds: 0.03, redo: 0.05, takeRate: 0.25, pros: 25, aiDriven: 0.8 },
  replicate: { bookingsPerMonth: 150_000, netTakePerMonth: 40_000, repeat: 0.4, pros: 40 },
} as const;

const T = CITY_TARGETS;
export const CITY_GATES: CityGate[] = [
  // traction — the city is alive
  { key: "volume", level: "traction", label: "Completed jobs (90 days)", target: `≥ ${T.traction.jobsPer90}`,
    test: (m) => m.completedJobs * (90 / Math.max(1, m.days)) >= T.traction.jobsPer90, value: (m) => String(m.completedJobs),
    fix: "More demand: Google Business Profile, local service ads for junk removal and cleaning, Nextdoor, property managers." },
  { key: "bookings_t", level: "traction", label: "Bookings per month", target: `≥ ${usd(T.traction.bookingsPerMonth)}`,
    test: (m) => perMonth(m, m.bookings) >= T.traction.bookingsPerMonth, value: (m) => usd(perMonth(m, m.bookings)),
    fix: "Push the services with the best payback first (junk removal, cleaning), then recurring plans." },
  { key: "fill_t", level: "traction", label: "Jobs covered by a pro", target: `≥ ${pct(T.traction.fill)}`,
    test: (m) => atLeast(m.fillRate, T.traction.fill), value: (m) => pct(m.fillRate),
    fix: "Recruit where Supply gaps shows unfilled jobs; turn on the lead engine for those trades." },
  { key: "pros_t", level: "traction", label: "Active pros in the city", target: `≥ ${T.traction.pros}`,
    test: (m) => m.activePros >= T.traction.pros, value: (m) => String(m.activePros),
    fix: "Indeed posts + lead engine; approve applicants faster (auto-invite)." },

  // proven — the model works here
  { key: "bookings_p", level: "proven", label: "Bookings per month", target: `≥ ${usd(T.proven.bookingsPerMonth)}`,
    test: (m) => perMonth(m, m.bookings) >= T.proven.bookingsPerMonth, value: (m) => usd(perMonth(m, m.bookings)),
    fix: "Scale the channels that already pay back; add commercial accounts (one property manager ≈ 50 homes)." },
  { key: "fill_p", level: "proven", label: "Jobs covered by a pro", target: `≥ ${pct(T.proven.fill)}`,
    test: (m) => atLeast(m.fillRate, T.proven.fill), value: (m) => pct(m.fillRate),
    fix: "Thin trades below need 2+ pros each; check Pricing accuracy for services pros pass on." },
  { key: "speed", level: "proven", label: "Hours to get a pro (median)", target: `≤ ${T.proven.hoursToAssign}h`,
    test: (m) => atMost(m.hoursToAssign, T.proven.hoursToAssign), value: (m) => (m.hoursToAssign === null ? "—" : `${m.hoursToAssign.toFixed(1)}h`),
    fix: "More pros on call; recurring visits offered to the same pro first; fix prices pros counter on." },
  { key: "thin", level: "proven", label: "Every busy trade has 2+ pros", target: "0 thin trades",
    test: (m) => m.thinTrades.length === 0, value: (m) => (m.thinTrades.length ? m.thinTrades.join(", ") : "none"),
    fix: "Recruit for the listed trades (lead engine, Indeed); a single pro per trade is a single point of failure." },
  { key: "pros_p", level: "proven", label: "Active pros in the city", target: `≥ ${T.proven.pros}`,
    test: (m) => m.activePros >= T.proven.pros, value: (m) => String(m.activePros),
    fix: "Keep recruiting ahead of demand: about 25 vetted pros is the plan's playbook for a metro." },
  { key: "repeat_p", level: "proven", label: "Customers who come back", target: `≥ ${pct(T.proven.repeat)}`,
    test: (m) => atLeast(m.repeatRate, T.proven.repeat), value: (m) => pct(m.repeatRate),
    fix: "Seasonal reminders, quote follow-ups and plan offers after every one-time job; check ratings." },
  { key: "plans", level: "proven", label: "One-time → recurring plan", target: `≥ ${pct(T.proven.planConversion)}`,
    test: (m) => atLeast(m.planConversion, T.proven.planConversion), value: (m) => pct(m.planConversion),
    fix: "Offer the plan right after a 5★ review; recurring visits go to the same pro first." },
  { key: "rating", level: "proven", label: "Average rating", target: `≥ ${T.proven.rating}★`,
    test: (m) => (m.reviews < 10 ? null : m.avgRating! >= T.proven.rating), value: (m) => (m.avgRating === null ? "—" : `${m.avgRating.toFixed(2)}★ (${m.reviews})`),
    fix: "Look at the lowest-rated pros' standing and the most-complained services; tighten QA." },
  { key: "refunds", level: "proven", label: "Refunds (share of bookings)", target: `≤ ${pct(T.proven.refunds)}`,
    test: (m) => (m.bookings > 0 ? m.refunded / m.bookings <= T.proven.refunds : null), value: (m) => pct(share(m.refunded, m.bookings)),
    fix: "Find the services and pros behind refunds; fix expectations in the booking questions." },
  { key: "redo", level: "proven", label: "Redos needed", target: `≤ ${pct(T.proven.redo)}`,
    test: (m) => atMost(m.redoRate, T.proven.redo), value: (m) => pct(m.redoRate),
    fix: "Probation reviews for new pros; photo QA standards per service." },
  { key: "take", level: "proven", label: "Our take rate (blended)", target: `≥ ${pct(T.proven.takeRate)}`,
    test: (m) => (m.bookings > 0 ? m.take / m.bookings >= T.proven.takeRate : null), value: (m) => pct(share(m.take, m.bookings)),
    fix: "Mix toward recurring and mid-size jobs; check Market pricing factors that drifted low." },
  { key: "ai", level: "proven", label: "AI-driven jobs (no human touch)", target: `≥ ${pct(T.proven.aiDriven)}`,
    test: (m) => atLeast(m.aiDrivenRate, T.proven.aiDriven), value: (m) => pct(m.aiDrivenRate),
    fix: "Look at why staff touched jobs (alerts, manual status changes) and automate the most common one." },

  // replicate — strong enough to copy into the next city
  { key: "bookings_r", level: "replicate", label: "Bookings per month", target: `≥ ${usd(T.replicate.bookingsPerMonth)}`,
    test: (m) => perMonth(m, m.bookings) >= T.replicate.bookingsPerMonth, value: (m) => usd(perMonth(m, m.bookings)),
    fix: "Year-2 plan pace for the first metro is about $195k/month in bookings." },
  { key: "net", level: "replicate", label: "Net take per month (funds the next city)", target: `≥ ${usd(T.replicate.netTakePerMonth)}`,
    test: (m) => perMonth(m, m.netTake) >= T.replicate.netTakePerMonth, value: (m) => usd(perMonth(m, m.netTake)),
    fix: "A new metro opens only when existing metros' profit can fund it (launcher, local ads, ~25 pros)." },
  { key: "repeat_r", level: "replicate", label: "Customers who come back", target: `≥ ${pct(T.replicate.repeat)}`,
    test: (m) => atLeast(m.repeatRate, T.replicate.repeat), value: (m) => pct(m.repeatRate),
    fix: "Recurring plans are the cheapest revenue to keep: push plan conversion." },
  { key: "pros_r", level: "replicate", label: "Active pros in the city", target: `≥ ${T.replicate.pros}`,
    test: (m) => m.activePros >= T.replicate.pros, value: (m) => String(m.activePros),
    fix: "Deep bench so the city runs without the launch team while they open the next one." },
];

export type GateState = "pass" | "fail" | "no_data";
export interface GateResult { key: string; level: GateLevel; label: string; target: string; value: string; state: GateState; fix: string; recent?: GateState }

export interface CityScore {
  stage: CityStage;
  /** All replicate gates pass in the 90-day window AND the last 30 days. */
  readyToReplicate: boolean;
  gates: GateResult[];
  /** Share of gates passing at the next level (0–1), for a progress meter. */
  progress: number;
  next: GateLevel | null;
  /** The failing gates of the next level — the to-do list. */
  todo: GateResult[];
}

const LEVELS: GateLevel[] = ["traction", "proven", "replicate"];
const evalGate = (g: CityGate, m: CityMetrics): GateState => { const r = g.test(m); return r === null ? "no_data" : r ? "pass" : "fail"; };

/** Score a market from its 90-day metrics (and, optionally, the last 30 days to confirm it's sustained). */
export function scoreCity(m90: CityMetrics, m30?: CityMetrics): CityScore {
  const gates: GateResult[] = CITY_GATES.map((g) => ({
    key: g.key, level: g.level, label: g.label, target: g.target, value: g.value(m90), state: evalGate(g, m90), fix: g.fix,
    ...(m30 ? { recent: evalGate(g, m30) } : {}),
  }));
  const levelPasses = (l: GateLevel) => gates.filter((g) => g.level === l).every((g) => g.state === "pass");
  let stage: CityStage = "launching";
  for (const l of LEVELS) { if (levelPasses(l)) stage = l; else break; }
  const readyToReplicate = stage === "replicate" && gates.filter((g) => g.level === "replicate" || g.level === "proven").every((g) => g.recent === undefined || g.recent === "pass");
  const next = stage === "replicate" ? null : LEVELS[LEVELS.indexOf(stage as GateLevel) + 1] ?? LEVELS[0];
  const nextGates = next ? gates.filter((g) => g.level === next) : [];
  return {
    stage, readyToReplicate, gates, next,
    progress: nextGates.length ? nextGates.filter((g) => g.state === "pass").length / nextGates.length : 1,
    todo: nextGates.filter((g) => g.state !== "pass"),
  };
}

export const CITY_STAGE_LABEL: Record<CityStage, string> = { launching: "Launching", traction: "Traction", proven: "Proven", replicate: "Ready to replicate" };

// ─── Company trajectory vs the growth plan ─────────────────────────────────────

/**
 * Growth plan — REVENUE MEANS OUR TAKE (what we keep), as the owner's plan defines it ("$10M revenue needs
 * ~$50M in gross marketplace volume at a 20% take"). Milestones: $10M in year 5, $50M in year 7, $100M in
 * year 10 (owner's goals); city counts follow the phase plan (1 city in years 1–2, 3–5 by year 5,
 * 15–20 by year 8, 40+ by year 10). Bookings shown = revenue ÷ PLAN_TAKE_RATE. aiDriven = share of jobs
 * with no human touch (80% early → 95% from year 6). Change the numbers here; every screen follows.
 */
export const PLAN_TAKE_RATE = 0.2;
export const GROWTH_PLAN = [
  { year: 1, revenue: 500_000, metros: 1, aiDriven: 0.8, phase: "Liquidity & proof of concept" },
  { year: 2, revenue: 2_000_000, metros: 1, aiDriven: 0.8, phase: "Liquidity & proof of concept" },
  { year: 3, revenue: 4_000_000, metros: 3, aiDriven: 0.85, phase: "B2B expansion" },
  { year: 4, revenue: 6_500_000, metros: 4, aiDriven: 0.9, phase: "B2B expansion" },
  { year: 5, revenue: 10_000_000, metros: 5, aiDriven: 0.9, phase: "B2B expansion — $10M" },
  { year: 6, revenue: 25_000_000, metros: 10, aiDriven: 0.95, phase: "Category dominance & regional scaling" },
  { year: 7, revenue: 50_000_000, metros: 15, aiDriven: 0.95, phase: "Category dominance — $50M" },
  { year: 8, revenue: 65_000_000, metros: 20, aiDriven: 0.95, phase: "Category dominance & regional scaling" },
  { year: 9, revenue: 82_000_000, metros: 30, aiDriven: 0.95, phase: "Network effects" },
  { year: 10, revenue: 100_000_000, metros: 40, aiDriven: 0.95, phase: "Network effects — $100M" },
].map((y) => ({ ...y, bookings: Math.round(y.revenue / PLAN_TAKE_RATE) }));

/** Owner's long-range goals, revenue = our take. */
export const LONG_RANGE_GOALS = [{ year: 5, revenue: 10_000_000 }, { year: 7, revenue: 50_000_000 }, { year: 10, revenue: 100_000_000 }] as const;

/** Where the company is against the growth plan: plan year, revenue (our take) and bookings pace, cities, AI target. */
export function planPace(o: { launchedAt: string | null; bookings30: number; take30: number; markets: number }, now = new Date()) {
  const start = o.launchedAt ? new Date(o.launchedAt) : now;
  const yearsIn = Math.max(0, (now.getTime() - start.getTime()) / (365.25 * 86400000));
  const year = Math.min(GROWTH_PLAN.length, Math.floor(yearsIn) + 1);
  const plan = GROWTH_PLAN[year - 1];
  const bookingsRunRate = (o.bookings30 / 30.4) * 365.25, takeRunRate = (o.take30 / 30.4) * 365.25;
  return {
    year, plan, bookingsRunRate, takeRunRate,
    /** Revenue (our take) run-rate ÷ this year's revenue target — the main number. */
    takePace: plan.revenue ? takeRunRate / plan.revenue : 0,
    bookingsPace: plan.bookings ? bookingsRunRate / plan.bookings : 0,
    metrosPace: o.markets / plan.metros,
    aiTarget: plan.aiDriven,
  };
}
