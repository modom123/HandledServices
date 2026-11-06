/*
 * FILE    : packages/core/src/roster-targets.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-06_0400 UTC
 * STATUS  : not wired in yet (paused); apps/web/lib/biz-leads.ts still uses the fixed city rotation.
 * PURPOSE : Win the business first, find the pro after. The AI goes after every business type in every area we serve;
 *           the approved roster only decides what comes first:
 *             rosterTargets()      — every (business type × area) pair: the ones the roster can staff today ranked by how
 *                                    many pros could take the work and how much of that business type's usual work they
 *                                    cover; the rest stay in play with `pros: 0` and the trades to recruit for them.
 *                                    Pairs already searched a lot rank lower, so discovery keeps moving to fresh ground.
 *             discoveryPlan()      — today's searches: about half where pros can deliver now, half new ground (where a
 *                                    deal means recruiting a pro). With no roster yet, all new ground.
 *             rosterJobSearches()  — job-board searches (title × area) for in-house jobs our pros could replace.
 *             rosterSummary()      — what the roster can do, for the Hub.
 *           Used by apps/web/lib/biz-leads.ts (Google Places discovery and Adzuna job-posting leads). Pure: no I/O.
 */
import { SERVICES } from "./services.ts";
import { BIZ_PARTNER_SEGMENT, BIZ_SEGMENTS, type BizSegment } from "./biz-lead-engine.ts";

/** The parts of an approved pro this needs. */
export interface RosterPro { trades: string[]; city?: string | null; state?: string | null; zip?: string | null; daily_capacity?: number | null }

export interface RosterTarget {
  segment: BizSegment;
  /** What Places searches "in": "Detroit, MI", or the pro's ZIP when no city is on file. */
  where: string;
  city: string | null;
  state: string | null;
  /** Pros based here who could do at least one of this business type's services. */
  pros: number;
  /** This business type's services the roster here can do (catalog slugs). */
  services: string[];
  /** Trades to recruit here to cover what this business type buys (empty when the roster covers it all). */
  recruit: string[];
  score: number;
}

/** An area we sell in (from the served cities), whether or not a pro is based there yet. */
export interface SalesArea { city: string; state: string }

/** Bookable, in-person services a pro with these trades can do. */
export function servicesForTrades(trades: string[]): string[] {
  const t = new Set(trades);
  return SERVICES.filter((s) => !s.remote && s.trades.some((x) => t.has(x))).map((s) => s.slug);
}

const areaOf = (p: RosterPro) => {
  const city = p.city?.trim() || null, state = p.state?.trim().toUpperCase() || null;
  if (city && state) return { key: `${city.toLowerCase()}|${state}`, where: `${city}, ${state}`, city, state };
  const zip = p.zip?.trim();
  if (zip && /^\d{5}$/.test(zip)) return { key: zip, where: zip, city: null, state };
  return null;
};

/**
 * Every (business type, area) the roster can serve, best first. `found` is how many leads each "segment|where" already
 * has; heavily searched pairs rank lower. Only the business types in `segments` are considered (default: all but partners).
 */
export function rosterTargets(pros: RosterPro[], o: { segments?: BizSegment[]; found?: Record<string, number>; areas?: SalesArea[] } = {}): RosterTarget[] {
  const segments = (o.segments ?? (Object.keys(BIZ_SEGMENTS) as BizSegment[])).filter((s) => (s as string) !== BIZ_PARTNER_SEGMENT && s in BIZ_SEGMENTS);
  const areas = new Map<string, { where: string; city: string | null; state: string | null; pros: { services: Set<string>; weight: number }[] }>();
  for (const p of pros) {
    const a = areaOf(p);
    if (!a || !p.trades?.length) continue;
    const entry = areas.get(a.key) ?? { where: a.where, city: a.city, state: a.state, pros: [] };
    // a pro who can take more jobs a day counts a little more (capped, so one big crew doesn't swamp the ranking)
    entry.pros.push({ services: new Set(servicesForTrades(p.trades)), weight: Math.min(2, Math.max(1, (p.daily_capacity ?? 1) / 2)) });
    areas.set(a.key, entry);
  }
  // every area we sell in is in play, pro or not
  for (const c of o.areas ?? []) {
    const key = `${c.city.trim().toLowerCase()}|${c.state.trim().toUpperCase()}`;
    if (!areas.has(key)) areas.set(key, { where: `${c.city.trim()}, ${c.state.trim().toUpperCase()}`, city: c.city.trim(), state: c.state.trim().toUpperCase(), pros: [] });
  }
  const out: RosterTarget[] = [];
  for (const a of areas.values()) {
    for (const segment of segments) {
      const wanted = BIZ_SEGMENTS[segment].services;
      const covering = a.pros.filter((p) => wanted.some((s) => p.services.has(s)));
      const services = wanted.filter((s) => covering.some((p) => p.services.has(s)));
      const recruit = tradesFor(wanted.filter((s) => !services.includes(s)));
      const breadth = services.length / wanted.length; // how much of what this business buys we can staff
      const depth = covering.reduce((n, p) => n + p.weight, 0); // how many pros could take it
      const already = o.found?.[`${segment}|${a.where}`] ?? 0;
      // uncovered pairs keep a base score: we still sell there and recruit the pro when the deal comes
      const raw = covering.length ? Math.log2(1 + depth) * 10 * (0.4 + breadth) + 3 : 3;
      const score = Math.round((raw / (1 + already / 40)) * 100) / 100;
      out.push({ segment, where: a.where, city: a.city, state: a.state, pros: covering.length, services, recruit, score });
    }
  }
  return out.sort((x, y) => y.score - x.score || y.pros - x.pros || x.where.localeCompare(y.where));
}

/** The main trade for each service (the first one listed), deduplicated — what to recruit for those services. */
export function tradesFor(slugs: string[]): string[] {
  const bySlug = new Map(SERVICES.map((s) => [s.slug, s]));
  return [...new Set(slugs.map((s) => bySlug.get(s)?.trades[0]).filter((t): t is string => Boolean(t)))];
}

/**
 * Today's searches: about half where the roster can deliver now (best first, rotating), the rest new ground rotating
 * through every other (business type × area), so no part of the market is skipped. No roster yet → all new ground.
 */
export function discoveryPlan(targets: RosterTarget[], n: number, day = Math.floor(Date.now() / 86400000)): RosterTarget[] {
  if (n <= 0 || !targets.length) return [];
  const staffed = targets.filter((t) => t.pros > 0), open = targets.filter((t) => t.pros === 0);
  const nStaffed = Math.min(staffed.length, open.length ? Math.ceil(n / 2) : n);
  const fromStaffed = pickDaily(staffed, nStaffed, day);
  const nOpen = Math.min(open.length, n - fromStaffed.length);
  // new ground: walk the whole list (least-searched first, since score already discounts searched pairs)
  const fromOpen = Array.from({ length: nOpen }, (_, i) => open[(day * nOpen + i) % open.length]);
  const seen = new Set<string>();
  return [...fromStaffed, ...fromOpen].filter((t) => { const k = `${t.segment}|${t.where}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

/**
 * Today's picks: `n` targets taken from the best ones, rotating daily so the same few don't repeat every morning.
 * The pool is the top 3n (at least 6), so strong pairs come back often and weak ones still get a turn.
 */
export function pickDaily<T>(ranked: T[], n: number, day = Math.floor(Date.now() / 86400000)): T[] {
  if (!ranked.length || n <= 0) return [];
  const pool = ranked.slice(0, Math.max(6, n * 3));
  return Array.from({ length: Math.min(n, pool.length) }, (_, i) => pool[(day * n + i) % pool.length]);
}

/** In-house job titles a business posts when it needs work our pros do (by trade). Competitor-only titles are left out. */
export const TRADE_JOB_TITLES: Record<string, string[]> = {
  cleaning: ["cleaner", "janitor", "custodian", "housekeeper", "porter"],
  windows: ["window cleaner"],
  carpet: ["carpet cleaner"],
  lawn: ["groundskeeper", "landscaper"],
  tree: ["groundskeeper"],
  snow: ["snow removal"],
  pool: ["pool attendant"],
  pressure_washing: ["porter"],
  handyman: ["maintenance technician", "handyman"],
  carpentry: ["maintenance technician"],
  painting: ["maintenance painter"],
  plumbing: ["maintenance plumber"],
  electrical: ["maintenance electrician"],
  hvac: ["maintenance hvac technician"],
  hauling: ["mover", "delivery driver"],
  security: ["security guard"],
  errands: ["courier"],
};

/** Job-board searches the roster could answer: each pro area × the titles its trades replace, most pros first. */
export function rosterJobSearches(pros: RosterPro[]): { where: string; state: string | null; what: string; pros: number }[] {
  const tally = new Map<string, { where: string; state: string | null; what: string; pros: number }>();
  for (const p of pros) {
    const a = areaOf(p);
    if (!a || !a.city) continue; // job boards search by city
    const titles = new Set(p.trades.flatMap((t) => TRADE_JOB_TITLES[t] ?? []));
    for (const what of titles) {
      const k = `${a.key}|${what}`;
      const e = tally.get(k) ?? { where: a.where, state: a.state, what, pros: 0 };
      e.pros++;
      tally.set(k, e);
    }
  }
  return [...tally.values()].sort((x, y) => y.pros - x.pros || x.where.localeCompare(y.where) || x.what.localeCompare(y.what));
}

/** For the Hub: how many approved pros, where, and which business types they can serve. */
export function rosterSummary(pros: RosterPro[]) {
  const targets = rosterTargets(pros).filter((t) => t.pros > 0);
  const bySegment = new Map<BizSegment, { pros: number; areas: number }>();
  for (const t of targets) {
    const e = bySegment.get(t.segment) ?? { pros: 0, areas: 0 };
    e.pros += t.pros; e.areas++;
    bySegment.set(t.segment, e);
  }
  return {
    pros: pros.length,
    placed: pros.filter((p) => areaOf(p)).length,
    areas: new Set(targets.map((t) => t.where)).size,
    segments: [...bySegment.entries()].map(([segment, v]) => ({ segment, label: BIZ_SEGMENTS[segment].label, ...v })).sort((a, b) => b.pros - a.pros),
    top: targets.slice(0, 8),
  };
}
