/*
 * FILE    : apps/web/lib/promo.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-07_0305 UTC
 * PURPOSE : The grand opening promotion's settings (Hub → Website & promotions, site_settings "launch_promo").
 *           Rules: packages/core/src/launch-promo.ts. LAUNCH_PROMO_START in Vercel works as a fallback until the Hub saves.
 */
import "server-only";
import { cache } from "react";
import { LAUNCH_PROMO_DEFAULT, launchState, type LaunchPromo } from "@handled/core";
import { adminClient } from "./supabase/server";
import { supabaseConfigured } from "./supabase/env";

// LAUNCH_PROMO_START=YYYY-MM-DD in Vercel turns the promotion on with the defaults (100 days, 20%) until the Hub saves settings
const envDefault = (): LaunchPromo => {
  const start = process.env.LAUNCH_PROMO_START?.trim() ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(start) ? { ...LAUNCH_PROMO_DEFAULT, enabled: true, start } : LAUNCH_PROMO_DEFAULT;
};

export const getLaunchPromo = cache(async (): Promise<LaunchPromo> => {
  const base = envDefault();
  if (!supabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return base;
  try {
    const { data } = await adminClient().from("site_settings").select("value").eq("key", "launch_promo").maybeSingle();
    return data?.value ? { ...LAUNCH_PROMO_DEFAULT, ...(data.value as Partial<LaunchPromo>) } : base;
  } catch { return base; }
});

/** The promotion right now (phase, end time, percent). */
export async function launchNow(now = new Date()) {
  return launchState(await getLaunchPromo(), now);
}
