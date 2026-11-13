/*
 * FILE    : packages/core/src/depth-chart.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-05_0030 UTC
 * PURPOSE : The pro roster as a football depth chart. Every service is a position to fill. For each position:
 *             starters / backups   approved pros cleared to work it (trade, license, insurance, background check, the
 *                                  coverages their trade needs), best first — specialists, rating, jobs done
 *             not cleared          approved pros with the trade but missing something (with the reason)
 *             in camp              pros still onboarding (applied / vetting) with the trade
 *             prospects            applications in the pipeline with the trade
 *           A position is "covered" (crossed off) when its depth target is met: 3 deep for the focus services, 2 deep
 *           for the rest (a starter and a backup). "thin" has a starter but not enough backups; "open" has nobody
 *           cleared. Locations: pass a state (MI / WA) to chart one region; remote services count pros anywhere.
 * UPDATED : 2026-11-05_0045 UTC — projected depth: the slots filled in order by who would play there once signed —
 *           cleared pros, then approved-but-not-cleared, then in camp (onboarding), then prospects (recruiting
 *           pipeline) — each tagged with its tier so the chart can color it, and projectedStatus / wouldCover: what the
 *           roster looks like if everyone in the pipeline signs. Prospects' specialties count for "specialist".
 * UPDATED : 2026-11-13_0200 UTC — a licensed service is cleared only once Handled has verified the license.
 */
import { MARKETING_FOCUS } from "./focus.ts";
import { CATEGORIES, SERVICES, type Service } from "./services.ts";
import type { Contractor } from "./types.ts";
import { coverageValid, requiredCoverages, specialtyMatch } from "./vetting.ts";

export type PositionStatus = "covered" | "thin" | "open";
export interface DepthPlayer { id: string; name: string; rating: number; jobs: number; specialist: boolean; state: string | null }
export interface Position {
  slug: string;
  name: string;
  icon: string;
  category: string;
  focus: boolean;
  target: number;
  status: PositionStatus;
  depth: DepthPlayer[];                                  // cleared, best first (depth[0] = starter)
  notCleared: (DepthPlayer & { reason: string })[];
  inCamp: DepthPlayer[];
  prospects: { id: string; name: string; specialist: boolean }[];
  need: number;                                          // more cleared pros to reach the target
  /** Everyone who could play the position, in depth order: cleared → not cleared → in camp → prospects. */
  projected: DepthSlot[];
  /** The position's status if everyone on the way signs and gets cleared. */
  projectedStatus: PositionStatus;
}
export interface Prospect { id: string; name: string; trades: string[]; specialties?: string[] | null; state?: string | null }
export type DepthTier = "cleared" | "not_cleared" | "in_camp" | "prospect";
export interface DepthSlot { id: string; name: string; tier: DepthTier; note: string; href: string }

/** Why an approved pro can't take this service yet (null = cleared). Location and schedule aren't part of it. */
export function clearedFor(c: Contractor, svc: Service, today = new Date()): string | null {
  const mine = svc.trades.filter((t) => c.trades.includes(t));
  if (!mine.length) return "trade mismatch";
  if (svc.licensed && !c.license_number) return "license needed";
  if (svc.licensed && !c.license_expires) return "license not verified yet";
  if (svc.licensed && new Date(`${c.license_expires}T23:59:59`) < today) return "license expired";
  if (!svc.insuranceOptional && (!c.insured_until || new Date(c.insured_until) < today)) return "insurance missing or expired";
  if (!c.background_checked) return "background check pending";
  const missing = requiredCoverages(mine).find((k) => !coverageValid(c.coverage, k, today));
  return missing ? `${missing.replace(/_/g, " ")} coverage missing` : null;
}

const player = (c: Contractor, slug: string): DepthPlayer => ({
  id: c.id, name: c.business_name || c.contact_name || "Pro", rating: Number(c.rating ?? 0), jobs: Number(c.jobs_completed ?? 0),
  specialist: specialtyMatch(c.specialties, slug), state: c.base_state ?? null,
});
/** Depth order: specialists first, then rating (only once they have jobs), then experience. */
const strength = (p: DepthPlayer) => (p.specialist ? 1000 : 0) + (p.jobs > 0 ? p.rating * 50 : 150) + Math.min(p.jobs, 300);

export function depthChart(input: { contractors: Contractor[]; prospects?: Prospect[]; state?: string | null; today?: Date }): Position[] {
  const today = input.today ?? new Date();
  const st = input.state?.toUpperCase() || null;
  const inRegion = (svc: Service, state: string | null | undefined) => !st || svc.remote || (state ?? "").toUpperCase() === st;
  const live = input.contractors.filter((c) => !(c as { dropped_at?: string | null }).dropped_at);
  return SERVICES.map((svc) => {
    const focus = MARKETING_FOCUS.services.includes(svc.slug);
    const target = focus ? 3 : 2;
    const has = (trades: string[]) => svc.trades.some((t) => trades.includes(t));
    const mine = live.filter((c) => has(c.trades) && inRegion(svc, c.base_state));
    const depth: DepthPlayer[] = [], notCleared: Position["notCleared"] = [], inCamp: DepthPlayer[] = [];
    for (const c of mine) {
      if (c.status === "approved") {
        const why = clearedFor(c, svc, today);
        if (why) notCleared.push({ ...player(c, svc.slug), reason: why }); else depth.push(player(c, svc.slug));
      } else if (c.status === "applied" || c.status === "vetting") inCamp.push(player(c, svc.slug));
    }
    depth.sort((a, b) => strength(b) - strength(a));
    const prospects = (input.prospects ?? []).filter((p) => has(p.trades) && (!p.state || inRegion(svc, p.state)))
      .map((p) => ({ id: p.id, name: p.name, specialist: specialtyMatch(p.specialties, svc.slug) }))
      .sort((a, b) => Number(b.specialist) - Number(a.specialist));
    notCleared.sort((a, b) => strength(b) - strength(a));
    inCamp.sort((a, b) => strength(b) - strength(a));
    const status: PositionStatus = depth.length >= target ? "covered" : depth.length ? "thin" : "open";
    const projected: DepthSlot[] = [
      ...depth.map((p) => ({ id: p.id, name: p.name, tier: "cleared" as const, note: p.specialist ? "specialist" : p.jobs ? `★ ${p.rating.toFixed(1)} · ${p.jobs} jobs` : "new", href: `/hub/pros/${p.id}` })),
      ...notCleared.map((p) => ({ id: p.id, name: p.name, tier: "not_cleared" as const, note: p.reason, href: `/hub/pros/${p.id}` })),
      ...inCamp.map((p) => ({ id: p.id, name: p.name, tier: "in_camp" as const, note: p.specialist ? "onboarding · specialist" : "onboarding", href: `/hub/pros/${p.id}` })),
      ...prospects.map((p) => ({ id: p.id, name: p.name, tier: "prospect" as const, note: p.specialist ? "applicant · specialist" : "applicant", href: `/hub/recruiting/${p.id}` })),
    ];
    const projectedStatus: PositionStatus = projected.length >= target ? "covered" : projected.length ? "thin" : "open";
    return {
      slug: svc.slug, name: svc.name, icon: svc.icon, category: svc.category, focus, target, status, depth, notCleared, inCamp, prospects,
      need: Math.max(0, target - depth.length), projected, projectedStatus,
    };
  });
}

/** The scoreboard: positions covered / thin / open overall and per category (in menu order). */
export function depthSummary(positions: Position[]) {
  const count = (list: Position[]) => ({
    total: list.length,
    covered: list.filter((p) => p.status === "covered").length,
    thin: list.filter((p) => p.status === "thin").length,
    open: list.filter((p) => p.status === "open").length,
    need: list.reduce((s, p) => s + p.need, 0),
    /** Positions that would be filled if everyone in camp and in the pipeline signs and gets cleared. */
    wouldCover: list.filter((p) => p.projectedStatus === "covered").length,
  });
  return {
    ...count(positions),
    categories: CATEGORIES.map((c) => ({ id: c.id, name: c.name, icon: c.icon, ...count(positions.filter((p) => p.category === c.id)) })).filter((c) => c.total),
  };
}
