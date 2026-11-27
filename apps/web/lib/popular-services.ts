/*
 * FILE    : apps/web/lib/popular-services.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-27_1530 UTC
 * PURPOSE : "Get it Handled" (/post) quick picks (owner, 2026-11-27: show the 4 or 5 services most people choose): counts
 *           the last 180 days of bookings by service, split into home (no business account) and business (on a business
 *           account), and ranks them with core popularPicks (defaults until there are enough). Cached for 6 hours.
 */
import "server-only";
import { unstable_cache } from "next/cache";
import { popularPicks } from "@handled/core";
import { adminClient } from "./supabase/server";
import { supabaseConfigured } from "./supabase/env";

export const popularServices = unstable_cache(async (): Promise<{ home: string[]; business: string[] }> => {
  const home: Record<string, number> = {}, business: Record<string, number> = {};
  if (supabaseConfigured && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const since = new Date(Date.now() - 180 * 86400000).toISOString();
    const { data } = await adminClient().from("jobs").select("service_slug, business_account_id").gte("created_at", since).neq("status", "cancelled").limit(50000);
    for (const j of (data ?? []) as { service_slug: string | null; business_account_id: string | null }[]) {
      if (!j.service_slug) continue;
      const m = j.business_account_id ? business : home;
      m[j.service_slug] = (m[j.service_slug] ?? 0) + 1;
    }
  }
  return { home: popularPicks("home", home), business: popularPicks("business", business) };
}, ["post-popular-services-v1"], { revalidate: 6 * 3600 });
