/*
 * FILE    : apps/web/lib/launch.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : TSTAMP UTC
 * PURPOSE : Is this service open for booking in this ZIP's city? (core launch.ts). Markets are read
 *           once a minute per server instance. Used by availability, booking and the quote page.
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

/** { open, market } for a service in a ZIP. Fails open if markets can't be read. */
export async function openFor(slug: string, zip: string | null | undefined) {
  try {
    const market = marketForZip(await launchMarkets(), zip);
    return { open: serviceOpen(market, slug), market: market?.name ?? null };
  } catch {
    return { open: true, market: null };
  }
}

export const clearLaunchCache = () => { cache = null; };
