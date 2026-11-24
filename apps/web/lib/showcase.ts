/*
 * FILE    : apps/web/lib/showcase.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-10_2000 UTC
 * PURPOSE : "New pros in the Handled Network" data for the website: approved pros who opted in (Pro portal → My info),
 *           as public cards (core showcaseChain: name, area, up to 5 services, rating) with their profile photo.
 *           Cached for 6 hours (SHOWCASE.refreshHours), so the chain updates as pros are approved without a database
 *           read on every page view. Photo links are signed for 8 days, longer than the cache. A pro turning it off
 *           clears the cache right away (api/pro/showcase). Returns [] when the database or the migration isn't there.
 * UPDATED : 2026-11-24_1900 UTC — every activated pro is in the chain (opted-in ones named, with photo; the rest nameless);
 *           networkStats() for the growth line; refreshShowcase() is called on activation / status changes so new pros
 *           appear right away.
 */
import "server-only";
import { unstable_cache } from "next/cache";
import { SHOWCASE, networkGrowth, showcaseChain, type Contractor, type ShowcaseCard } from "@handled/core";
import { adminClient } from "./supabase/server";
import { supabaseConfigured } from "./supabase/env";
import { profilePhotos } from "./person-files";

export const SHOWCASE_TAG = "pro-showcase";
export type ShowcaseEntry = ShowcaseCard & { photo: string | null };

const load = unstable_cache(async (): Promise<ShowcaseEntry[]> => {
  if (!supabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const { data, error } = await adminClient().from("contractors").select("*").eq("status", "approved")
    .order("onboarded_at", { ascending: false, nullsFirst: false }).limit(200);
  if (error || !data) return []; // migration 20261110200000_pro_showcase not run yet
  const cards = showcaseChain(data as Contractor[], { limit: 60 });
  // photos only for pros who opted in to being featured
  const photos = await profilePhotos("pro", cards.filter((c) => c.named).map((c) => c.id), 8 * 86400).catch(() => new Map<string, string>());
  return cards.map((c) => ({ ...c, photo: c.named ? photos.get(c.id) ?? null : null }));
}, ["pro-showcase-v2"], { revalidate: SHOWCASE.refreshHours * 3600, tags: [SHOWCASE_TAG] });

/** The newest featured pros, everywhere or in one state. */
export async function featuredPros(o: { state?: string | null; limit?: number } = {}): Promise<ShowcaseEntry[]> {
  const all = await load().catch(() => [] as ShowcaseEntry[]);
  const st = o.state?.toUpperCase() || null;
  return all.filter((c) => !st || c.state === st).slice(0, o.limit ?? SHOWCASE.limit);
}

/** "N vetted pros · +X this month · in Y states" over the chain (same cache and refresh as the chain). */
export const networkStats = unstable_cache(async () => {
  if (!supabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { data, error } = await adminClient().from("contractors").select("status, onboarded_at, base_state").eq("status", "approved").limit(20000);
  return error || !data ? null : networkGrowth(data as { status: string; onboarded_at: string | null; base_state: string | null }[]);
}, ["pro-network-stats-v1"], { revalidate: SHOWCASE.refreshHours * 3600, tags: [SHOWCASE_TAG] });

/** Call when a pro is activated, suspended or changes what's public: the chain updates on the next page view. */
export async function refreshShowcase() {
  const { revalidateTag } = await import("next/cache");
  try { revalidateTag(SHOWCASE_TAG, "max"); } catch { /* outside a request (cron): the 6-hour refresh covers it */ }
}
