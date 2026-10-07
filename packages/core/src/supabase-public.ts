/*
 * FILE    : packages/core/src/supabase-public.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-06_1955 UTC
 * PURPOSE : The production Supabase project's PUBLIC settings — the URL and the publishable key. Both are meant to be
 *           public (every browser and app install sees them); row-level security protects the data. Used as the
 *           default when NEXT_PUBLIC_SUPABASE_* / EXPO_PUBLIC_SUPABASE_* aren't set, so the website and the app reach
 *           the right project out of the box. Environment variables still win (staging, local).
 *           NEVER put the secret / service_role key here or anywhere in the code — it only goes in Vercel's
 *           environment variables (SUPABASE_SERVICE_ROLE_KEY).
 */
export const SUPABASE_PUBLIC = {
  url: "https://qpzkayrfcunzelnhcrff.supabase.co",
  publishableKey: "sb_publishable_AoOckoK73PvM96_bMr0Obg_ZGZykQZ1",
} as const;
