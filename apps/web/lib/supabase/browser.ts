/*
 * FILE    : apps/web/lib/supabase/browser.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 */
"use client";
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL } from "./env";

export const browserClient = () => createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
