/*
 * FILE    : apps/web/app/api/hub/site/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0250 UTC
 * PURPOSE : Hub → Website (admins). POST JSON:
 *             { action: "theme", theme: "classic" | "greengold" | "modern" | "bwg" | "bluegreen" } — the default website look
 *             { action: "booking_without_pro", on: boolean } — take bookings where no pro covers the area yet
 * UPDATED : 2026-10-12_0032 UTC — booking_without_pro switch (Hub → Dispatch).
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { THEMES } from "@/lib/theme";
import { BOOKING_WITHOUT_PRO_KEY } from "@/lib/booking-settings";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("theme"), theme: z.string().refine((t) => t in THEMES) }),
  z.object({ action: z.literal("booking_without_pro"), on: z.boolean() }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (v?.role !== "admin") return deny(403, "Admins only");
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check the settings");
  const { action, ...value } = b.data;
  const key = action === "theme" ? "site_theme" : BOOKING_WITHOUT_PRO_KEY;
  const { error } = await adminClient().from("site_settings").upsert({ key, value, updated_at: new Date().toISOString(), updated_by: v.email });
  return error ? deny(500, /site_settings/.test(error.message) ? "Run the site settings SQL first (see the page)" : error.message) : Response.json({ ok: true });
}
