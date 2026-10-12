/*
 * FILE    : apps/web/lib/booking-settings.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-12_0032 UTC
 * PURPOSE : "Take bookings where no pro covers the area yet" — the switch on Hub → Dispatch (admins change it).
 *           On (the default): customers can book and pay even when no vetted pro covers their ZIP; staff get an alert to
 *           recruit or line up a pro, and the job waits in Dispatch. Off: those customers join the waitlist instead.
 *           Stored in site_settings (key "booking_without_pro"); BOOK_WITHOUT_PRO=off in Vercel is the fallback.
 *           Outside Michigan / Washington and services not launched in a city stay closed either way.
 */
import "server-only";
import { cache } from "react";
import { adminClient } from "./supabase/server";
import { supabaseConfigured } from "./supabase/env";

export const BOOKING_WITHOUT_PRO_KEY = "booking_without_pro";

/** True when customers may book where no pro covers the ZIP yet. Cached per request. */
export const bookingWithoutPro = cache(async (): Promise<boolean> => {
  if (supabaseConfigured && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { data } = await adminClient().from("site_settings").select("value").eq("key", BOOKING_WITHOUT_PRO_KEY).maybeSingle();
      const on = (data?.value as { on?: unknown } | null)?.on;
      if (typeof on === "boolean") return on;
    } catch { /* table not created yet */ }
  }
  return !/^(off|false|0|no)$/i.test(process.env.BOOK_WITHOUT_PRO ?? "");
});
