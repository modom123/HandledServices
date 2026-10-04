/*
 * FILE    : packages/core/src/launch.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-04_1934 UTC
 * PURPOSE : Constraint-driven launch: a city opens with a short list of frequent, simple services
 *           (hauling, small moves, basic cleaning, lawn, handyman, turnovers) so every booking gets a
 *           pro fast; everything else shows "coming soon" with a waitlist until the city is ready.
 *           A market with no launch list (null) has every service open.
 */

export interface LaunchMarket { id?: string; name?: string; zip_prefixes: string[]; active?: boolean; launch_services?: string[] | null }

/** Recommended first services for a new city (growth plan, phase 1). */
export const LAUNCH_SET_RECOMMENDED = [
  "house-cleaning", "lawn-care", "leaf-removal", "snow-removal", "handyman", "unit-turnover", "junk-removal", "large-item-removal", "small-moves",
] as const;

/** The market a ZIP belongs to (first match). */
export function marketForZip<M extends LaunchMarket>(markets: M[], zip: string | null | undefined): M | null {
  if (!zip) return null;
  return markets.find((m) => m.active !== false && m.zip_prefixes.some((p) => zip.startsWith(p))) ?? null;
}

/** Whether a service can be booked in a market. Outside every market we don't block (no launch list applies). */
export function serviceOpen(market: LaunchMarket | null, slug: string): boolean {
  if (!market || !market.launch_services || !market.launch_services.length) return true;
  return market.launch_services.includes(slug);
}
