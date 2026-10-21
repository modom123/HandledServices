/*
 * FILE    : apps/web/lib/launch.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-04_1934 UTC
 * PURPOSE : Is this service open for booking in this ZIP's city? (core launch.ts). Markets are read
 *           once a minute per server instance. Used by availability, booking and the quote page.
 * UPDATED : 2026-10-07_1640 UTC — service areas grow with bookings: a booked ZIP outside every market is added to that state's
 *           "new areas" market (addZipToServiceArea). Outside ZIPs stay bookable when a pro covers them.
 * UPDATED : 2026-10-07_1700 UTC — Handled serves Michigan and Washington (SERVED_STATES, by ZIP range). ZIPs in other states
 *           are closed (waitlist); a Michigan / Washington ZIP missing from every market is still bookable and gets added.
 * UPDATED : 2026-10-07_1830 UTC — regionFactor(zip): the service area's price level (markets.price_multiplier).
 * UPDATED : 2026-10-11_0608 UTC — remote services (Service.remote) are open in every US ZIP and have no area price level.
 * UPDATED : 2026-10-21_0200 UTC — pro-led rollout: a service outside a city's launch list opens in a ZIP as soon as an approved
 *           pro would be offered it there (dispatch's eligible(): trade, license, insurance, background check, service
 *           area), and closes again if no pro covers it. The waitlist for that service and ZIP is told on the next sweep.
 */
import "server-only";
import { eligible, getService, marketForZip, serviceOpen, type Contractor, type LaunchMarket } from "@handled/core";
import { zipCentroid } from "./geo";
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
export async function openFor(slug: string, zip: string | null | undefined): Promise<{ open: boolean; market: string | null; viaPro?: boolean }> {
  if (getService(slug)?.remote) return { open: true, market: null }; // done remotely: any US ZIP
  try {
    const market = marketForZip(await launchMarkets(), zip);
    if (!market) return { open: Boolean(servedState(zip)), market: null };
    if (serviceOpen(market, slug)) return { open: true, market: market.name ?? null };
    // pro-led rollout: not on the city's launch list yet, but a vetted pro covers it here → bookable
    if (await proCovers(slug, zip)) return { open: true, market: market.name ?? null, viaPro: true };
    return { open: false, market: market.name ?? null };
  } catch {
    return { open: true, market: null };
  }
}

const proCache = new Map<string, { at: number; pros: Contractor[] }>();
const coverCache = new Map<string, { at: number; covered: boolean }>();

/** An approved pro would be offered this service in this ZIP (same check as dispatch). Cached a minute. */
export async function proCovers(slug: string, zip: string | null | undefined): Promise<boolean> {
  const svc = getService(slug);
  if (!svc || !zip || !/^\d{5}$/.test(zip) || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  const key = `${slug}|${zip}`, hit = coverCache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.covered;
  let pros = proCache.get(slug);
  if (!pros || Date.now() - pros.at > 60_000) {
    const { data } = await adminClient().from("contractors").select("*").eq("status", "approved").overlaps("trades", svc.trades).limit(500);
    pros = { at: Date.now(), pros: (data ?? []) as Contractor[] };
    proCache.set(slug, pros);
  }
  const g = pros.pros.length ? await zipCentroid(zip).catch(() => null) : null;
  const covered = pros.pros.some((c) => eligible(c, { service_slug: slug, zip, scheduled_date: null, lat: g?.lat ?? null, lng: g?.lng ?? null }) === null);
  coverCache.set(key, { at: Date.now(), covered });
  return covered;
}

export const clearLaunchCache = () => { cache = null; proCache.clear(); coverCache.clear(); };

/** The area's price level for a ZIP (markets.price_multiplier: Seattle area 1.25, rest of Washington 1.20, Michigan 1). */
export async function regionFactor(zip: string | null | undefined, slug?: string): Promise<number> {
  if (slug && getService(slug)?.remote) return 1; // remote work costs the same everywhere
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
