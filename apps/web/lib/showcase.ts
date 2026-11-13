/*
 * FILE    : apps/web/lib/showcase.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-10_2000 UTC
 * PURPOSE : "New pros in the Handled Network" data for the website: approved pros who opted in (Pro portal → My info),
 *           as public cards (core showcaseChain: name, area, up to 5 services, rating) with their profile photo.
 *           Cached for 6 hours (SHOWCASE.refreshHours), so the chain updates as pros are approved without a database
 *           read on every page view. Photo links are signed for 8 days, longer than the cache. A pro turning it off
 *           clears the cache right away (api/pro/showcase). Returns [] when the database or the migration isn't there.
 * UPDATED : 2026-11-13_1900 UTC — refreshShowcase(): the chain rebuilds right away when a pro goes live, opts in or out,
 *           changes their photo, services or area (it used to wait up to 6 hours for anything but opting out).
 */
import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { SHOWCASE, showcaseChain, type Contractor, type ShowcaseCard } from "@handled/core";
import { adminClient } from "./supabase/server";
import { supabaseConfigured } from "./supabase/env";
import { profilePhotos } from "./person-files";

export const SHOWCASE_TAG = "pro-showcase";
export type ShowcaseEntry = ShowcaseCard & { photo: string | null };

const load = unstable_cache(async (): Promise<ShowcaseEntry[]> => {
  if (!supabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const { data, error } = await adminClient().from("contractors").select("*").eq("status", "approved").eq("showcase_opt_in", true)
    .order("onboarded_at", { ascending: false, nullsFirst: false }).limit(200);
  if (error || !data) return []; // migration 20261110200000_pro_showcase not run yet
  const cards = showcaseChain(data as Contractor[], { limit: 60 });
  const photos = await profilePhotos("pro", cards.map((c) => c.id), 8 * 86400).catch(() => new Map<string, string>());
  return cards.map((c) => ({ ...c, photo: photos.get(c.id) ?? null }));
}, ["pro-showcase-v1"], { revalidate: SHOWCASE.refreshHours * 3600, tags: [SHOWCASE_TAG] });

/** The newest featured pros, everywhere or in one state. */
export async function featuredPros(o: { state?: string | null; limit?: number } = {}): Promise<ShowcaseEntry[]> {
  const all = await load().catch(() => [] as ShowcaseEntry[]);
  const st = o.state?.toUpperCase() || null;
  return all.filter((c) => !st || c.state === st).slice(0, o.limit ?? SHOWCASE.limit);
}

/**
 * Something on the website chain changed (a pro went live, opted in or out, changed their photo, services or area):
 * rebuild it on the next page view instead of waiting up to 6 hours. Safe to call anywhere; never throws.
 */
export function refreshShowcase() {
  try { revalidateTag(SHOWCASE_TAG, "max"); } catch (e) { console.error("[showcase] refresh", e instanceof Error ? e.message : e); }
}
