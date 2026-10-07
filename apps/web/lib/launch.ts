/*
 * FILE    : apps/web/lib/launch.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-04_1934 UTC
 * PURPOSE : Is this service open for booking in this ZIP's city? (core launch.ts). Markets are read
 *           once a minute per server instance. Used by availability, booking and the quote page.
 * UPDATED : 2026-10-07_1640 UTC — service areas grow with bookings: a booked ZIP outside every market is added to that state's
 *           "new areas" market (addZipToServiceArea). Outside ZIPs stay bookable when a pro covers them.
 */
import "server-only";
import { marketForZip, serviceOpen, type LaunchMarket } from "@handled/core";
import { adminClient } from "./supabase/server";

let cache: { at: number; markets: LaunchMarket[] } | null = null;

export async function launchMarkets(): Promise<LaunchMarket[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.markets;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const { data } = await adminClient().from("markets").select("id, name, zip_prefixes, active, launch_services");
  cache = { at: Date.now(), markets: (data ?? []) as LaunchMarket[] };
  return cache.markets;
}

/**
 * { open, market } for a service in a ZIP. A ZIP outside every market is open: booking still requires a vetted pro who
 * covers it (no pro → waitlist, nothing charged), and the first booking adds the ZIP to a service area (addZipToServiceArea).
 * Fails open if markets can't be read.
 */
export async function openFor(slug: string, zip: string | null | undefined) {
  try {
    const market = marketForZip(await launchMarkets(), zip);
    return { open: serviceOpen(market, slug), market: market?.name ?? null };
  } catch {
    return { open: true, market: null };
  }
}

export const clearLaunchCache = () => { cache = null; };

const STATE_NAME: Record<string, string> = { MI: "Michigan", OH: "Ohio", IN: "Indiana", IL: "Illinois", WI: "Wisconsin" };

/**
 * A job was booked: if its ZIP isn't in any service area yet, add it — to the state's "new areas" market (created on first
 * use, no launch list, so every service is bookable there). Staff can move ZIPs into a named market in Hub → Cities.
 */
export async function addZipToServiceArea(zip: string | null | undefined, state: string | null | undefined) {
  if (!zip || !/^\d{5}$/.test(zip) || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  clearLaunchCache();
  if (marketForZip(await launchMarkets(), zip)) return null; // already served
  const st = (state ?? "").trim().toUpperCase().slice(0, 2) || "MI";
  const name = `${STATE_NAME[st] ?? st} — new areas`;
  const db = adminClient();
  const { data: m } = await db.from("markets").select("id, zip_prefixes").eq("name", name).maybeSingle();
  if (m) {
    const zips = [...new Set([...((m.zip_prefixes ?? []) as string[]), zip])];
    await db.from("markets").update({ zip_prefixes: zips, active: true }).eq("id", m.id);
  } else {
    await db.from("markets").insert({ name, state: st, zip_prefixes: [zip] });
  }
  clearLaunchCache();
  return name;
}
