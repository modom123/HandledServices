/*
 * FILE    : apps/web/app/api/hub/site/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0250 UTC
 * PURPOSE : Hub → Website (admins). POST JSON:
 *             { action: "theme", theme: "classic" | "greengold" | "modern" | "bwg" | "bluegreen" | "pro" } — the default website look
 *             { action: "booking_without_pro", on: boolean } — take bookings where no pro covers the area yet
 * UPDATED : 2026-10-12_0032 UTC — booking_without_pro switch (Hub → Dispatch).
 * UPDATED : 2026-11-17_1530 UTC — { action: "call_hours", hours } — when customers can book a call (Hub → Lead inbox); cleaned
 *           by core cleanCallHours before saving.
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { THEMES } from "@/lib/theme";
import { BOOKING_WITHOUT_PRO_KEY } from "@/lib/booking-settings";
import { CALL_HOURS_KEY } from "@/lib/call-schedule";
import { cleanCallHours } from "@handled/core";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("theme"), theme: z.string().refine((t) => t in THEMES) }),
  z.object({ action: z.literal("booking_without_pro"), on: z.boolean() }),
  z.object({ action: z.literal("call_hours"), hours: z.record(z.string(), z.unknown()) }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (v?.role !== "admin") return deny(403, "Admins only");
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check the settings");
  const { action, ...rest } = b.data;
  const key = action === "theme" ? "site_theme" : action === "call_hours" ? CALL_HOURS_KEY : BOOKING_WITHOUT_PRO_KEY;
  const value = b.data.action === "call_hours" ? cleanCallHours(b.data.hours) : rest;
  const { error } = await adminClient().from("site_settings").upsert({ key, value, updated_at: new Date().toISOString(), updated_by: v.email });
  return error ? deny(500, /site_settings/.test(error.message) ? "Run the site settings SQL first (see the page)" : error.message) : Response.json({ ok: true });
}
