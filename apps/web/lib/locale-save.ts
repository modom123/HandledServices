/*
 * FILE    : apps/web/lib/locale-save.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1412 UTC
 * PURPOSE : Save a signed-in person's language (English / Spanish) on their account — every text,
 *           email, push notification and timeline entry they get follows it. Guests: the cookie
 *           only (their bookings carry the language they booked in).
 */
import "server-only";
import type { Locale } from "@handled/core";
import { getViewer } from "./auth";
import { adminClient } from "./supabase/server";

export async function saveLocale(req: Request, l: Locale) {
  try {
    const v = await getViewer(req);
    if (v) await adminClient().from("profiles").update({ locale: l }).eq("id", v.userId);
  } catch { /* not signed in / not configured — cookie is enough */ }
}
