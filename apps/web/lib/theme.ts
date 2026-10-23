/*
 * FILE    : apps/web/lib/theme.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0235 UTC
 * PURPOSE : Three website looks that can be switched per market without a redeploy:
 *             classic    — the original green, now on light blue
 *             greengold  — green, white and gold
 *             modern     — green, white and gold with the modern layout (line icons, display type, soft shadows)
 *           Which one a visitor sees: a ?theme= link they arrived from (remembered 90 days — use a different link in each
 *           market's ads, flyers and QR codes), else the default chosen in Hub → Website look, else SITE_THEME, else classic
 *           (the Original look — the owner's choice for launch, 2026-10-07), then bwg: black, white & green (final launch
 *           choice, 2026-10-07).
 * UPDATED : 2026-10-07_0615 UTC — default back to classic (the Original look), owner's choice "for now". The other three
 *           looks stay available by ?theme= link and Hub → Website look.
 *           Colors are CSS variables per theme (globals.css, [data-theme] on <html>).
 * UPDATED : 2026-10-23_0430 UTC — new look: bluegreen (blue, white & green), now the system default (when no default is saved
 *           in Hub → Website look and SITE_THEME isn't set). Each look carries color swatches for the Hub picker.
 */
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { adminClient } from "./supabase/server";
import { supabaseConfigured } from "./supabase/env";

export const THEMES = {
  classic: { name: "Original", note: "Green on a light blue background, the first design", colors: ["#eaf4fb", "#0a4a3e", "#0e7c66", "#9fe6cc"] },
  greengold: { name: "Green, white & gold", note: "White pages, deeper greens, gold accents", colors: ["#ffffff", "#0a3a2c", "#0f6b50", "#c4993a"] },
  modern: { name: "Modern", note: "Green, white & gold with line icons, bigger type, soft shadows and a product-style hero", colors: ["#ffffff", "#0a3a2c", "#0f6b50", "#e8cc7a"] },
  bwg: { name: "Black, white & green", note: "White pages, black panels and type, green buttons", colors: ["#ffffff", "#0a0a0a", "#0b7a4e", "#4ade80"] },
  bluegreen: { name: "Blue, white & green", note: "Blue background, white cards, navy panels and type, green buttons", colors: ["#d4e5fb", "#ffffff", "#1e3a8a", "#166534"] },
} as const;
export type Theme = keyof typeof THEMES;
export const THEME_COOKIE = "site_theme";
export const isTheme = (v: unknown): v is Theme => typeof v === "string" && v in THEMES;

/** The default look set in the Hub (falls back to SITE_THEME, then Blue, white & green). Cached per request. */
export const defaultTheme = cache(async (): Promise<Theme> => {
  if (supabaseConfigured && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { data } = await adminClient().from("site_settings").select("value").eq("key", "site_theme").maybeSingle();
      const v = (data?.value as { theme?: string } | null)?.theme;
      if (isTheme(v)) return v;
    } catch { /* table not created yet */ }
  }
  return isTheme(process.env.SITE_THEME) ? process.env.SITE_THEME : "bluegreen";
});

/** The look for this visitor: their ?theme= link (cookie) or the default. */
export const getTheme = cache(async (): Promise<Theme> => {
  try {
    const c = (await cookies()).get(THEME_COOKIE)?.value;
    if (isTheme(c)) return c;
  } catch { /* outside a request */ }
  return defaultTheme();
});
