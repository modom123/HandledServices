/*
 * FILE    : apps/web/lib/launch.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-04_1934 UTC
 * PURPOSE : Is this service open for booking in this ZIP's city? (core launch.ts). Markets are read
 *           once a minute per server instance. Used by availability, booking and the quote page.
 * UPDATED : 2026-10-07_1610 UTC — ZIPs outside every market are closed (waitlist) instead of bookable.
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
 * { open, market } for a service in a ZIP. A ZIP outside every market we serve is closed (waitlist), so nobody pays for
 * work we can't send anyone to. Fails open if markets can't be read.
 */
export async function openFor(slug: string, zip: string | null | undefined) {
  try {
    const markets = await launchMarkets();
    const market = marketForZip(markets, zip);
    if (!market && markets.some((m) => m.active !== false)) return { open: false, market: null };
    return { open: serviceOpen(market, slug), market: market?.name ?? null };
  } catch {
    return { open: true, market: null };
  }
}

export const clearLaunchCache = () => { cache = null; };
