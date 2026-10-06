/*
 * FILE    : apps/web/lib/supabase/env.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-06_1955 UTC — defaults to the production project's public URL and publishable key
 *           (@handled/core SUPABASE_PUBLIC) when the NEXT_PUBLIC_ variables aren't set; env vars still win.
 */
import { SUPABASE_PUBLIC } from "@handled/core";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_PUBLIC.url;
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLIC.publishableKey;
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);
