/*
 * FILE    : apps/web/lib/launch.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-04_1934 UTC
 * PURPOSE : Is this service open for booking in this ZIP's city? (core launch.ts). Markets are read
 *           once a minute per server instance. Used by availability, booking and the quote page.
 * UPDATED : 2026-10-07_1640 UTC — service areas grow with bookings: a booked ZIP outside every market is added to that state's
 *           "new areas" market (addZipToServiceArea). Outside ZIPs stay bookable when a pro covers them.
 * UPDATED : 2026-10-07_1700 UTC — Handled serves Michigan and Washington (SERVED_STATES, by ZIP range). ZIPs in other states
 *           are closed (waitlist); a Michigan / Washington ZIP missing from every market is still bookable and gets added.
 * UPDATED : 2026-10-07_1830 UTC — regionFactor(zip): the service area's price level (markets.price_multiplier).
 */
import "server-only";
import { marketForZip, serviceOpen, type LaunchMarket } from "@handled/core";
import { adminClient } from "./supabase/server";

let cache: { at: number; markets: LaunchMarket[] } | null = null;

export async function launchMarkets(): Promise<LaunchMarket[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.markets;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const { data } = await adminClient().from("markets").select("id, name, zip_prefixes, active, launch_services, price_multiplier");
  cache = { at: Date.now(), markets: (data ?? []) as LaunchMarket[] };
  return cache.markets;
}

/** The states Handled serves, by 3-digit ZIP range. Add a state here (and its markets) to open it. */
export const SERVED_STATES: { state: string; name: string; from: number; to: number; priceMultiplier: number }[] = [
  { state: "MI", name: "Michigan", from: 480, to: 499, priceMultiplier: 1 },
  { state: "WA", name: "Washington", from: 980, to: 994, priceMultiplier: 1.2 }, // rest of WA +20% (Seattle-area markets are 1.25)
];
export const servedState = (zip: string | null | undefined) => {
  const p = zip && /^\d{5}$/.test(zip) ? Number(zip.slice(0, 3)) : NaN;
  return SERVED_STATES.find((s) => p >= s.from && p <= s.to) ?? null;
};

/**
 * { open, market } for a service in a ZIP. Outside Michigan and Washington: closed (waitlist). Inside them but in no market
 * yet: open — booking still needs a vetted pro who covers it (no pro → waitlist, nothing charged), and the first booking
 * adds the ZIP to a service area (addZipToServiceArea). Fails open if markets can't be read.
 */
export async function openFor(slug: string, zip: string | null | undefined) {
  try {
    const market = marketForZip(await launchMarkets(), zip);
    if (!market) return { open: Boolean(servedState(zip)), market: null };
    return { open: serviceOpen(market, slug), market: market.name };
  } catch {
    return { open: true, market: null };
  }
}

export const clearLaunchCache = () => { cache = null; };

/** The area's price level for a ZIP (markets.price_multiplier: Seattle area 1.25, rest of Washington 1.20, Michigan 1). */
export async function regionFactor(zip: string | null | undefined): Promise<number> {
  try {
    const m = marketForZip(await launchMarkets(), zip);
    const f = Number(m?.price_multiplier ?? 1);
    return Number.isFinite(f) && f > 0 ? f : 1;
  } catch { return 1; }
}

/**
 * A job was booked: if its ZIP isn't in any service area yet, add it — to the state's "new areas" market (created on first
 * use, no launch list, so every service is bookable there). Staff can move ZIPs into a named market in Hub → Cities.
 */
export async function addZipToServiceArea(zip: string | null | undefined, _state?: string | null) {
  if (!zip || !/^\d{5}$/.test(zip) || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  clearLaunchCache();
  if (marketForZip(await launchMarkets(), zip)) return null; // already served
  const served = servedState(zip); // the ZIP decides the state (a typo in the address form can't open a new state)
  if (!served) return null;
  const st = served.state;
  const name = `${served.name} — new areas`;
  const db = adminClient();
  const { data: m } = await db.from("markets").select("id, zip_prefixes").eq("name", name).maybeSingle();
  if (m) {
    const zips = [...new Set([...((m.zip_prefixes ?? []) as string[]), zip])];
    await db.from("markets").update({ zip_prefixes: zips, active: true }).eq("id", m.id);
  } else {
    await db.from("markets").insert({ name, state: st, zip_prefixes: [zip], price_multiplier: served.priceMultiplier });
  }
  clearLaunchCache();
  return name;
}
