/*
 * FILE    : apps/web/lib/theme.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-07_0235 UTC
 * PURPOSE : Three website looks that can be switched per market without a redeploy:
 *             classic    — the original green & cream
 *             greengold  — green, white and gold
 *             modern     — green, white and gold with the modern layout (line icons, display type, soft shadows)
 *           Which one a visitor sees: a ?theme= link they arrived from (remembered 90 days — use a different link in each
 *           market's ads, flyers and QR codes), else the default chosen in Hub → Website look, else SITE_THEME, else greengold.
 *           Colors are CSS variables per theme (globals.css, [data-theme] on <html>).
 */
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { adminClient } from "./supabase/server";
import { supabaseConfigured } from "./supabase/env";

export const THEMES = {
  classic: { name: "Original", note: "Green and cream, the first design" },
  greengold: { name: "Green, white & gold", note: "White pages, deeper greens, gold accents" },
  modern: { name: "Modern", note: "Green, white & gold with line icons, bigger type, soft shadows and a product-style hero" },
} as const;
export type Theme = keyof typeof THEMES;
export const THEME_COOKIE = "site_theme";
export const isTheme = (v: unknown): v is Theme => typeof v === "string" && v in THEMES;

/** The default look set in the Hub (falls back to SITE_THEME, then greengold). Cached per request. */
export const defaultTheme = cache(async (): Promise<Theme> => {
  if (supabaseConfigured && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { data } = await adminClient().from("site_settings").select("value").eq("key", "site_theme").maybeSingle();
      const v = (data?.value as { theme?: string } | null)?.theme;
      if (isTheme(v)) return v;
    } catch { /* table not created yet */ }
  }
  return isTheme(process.env.SITE_THEME) ? process.env.SITE_THEME : "greengold";
});

/** The look for this visitor: their ?theme= link (cookie) or the default. */
export const getTheme = cache(async (): Promise<Theme> => {
  try {
    const c = (await cookies()).get(THEME_COOKIE)?.value;
    if (isTheme(c)) return c;
  } catch { /* outside a request */ }
  return defaultTheme();
});
