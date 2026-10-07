/*
 * FILE    : apps/web/app/api/hub/site/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-07_0250 UTC
 * PURPOSE : Hub → Website & promotions (admins). POST JSON:
 *             { action: "theme", theme: "classic" | "greengold" | "modern" }   — the default website look
 *             { action: "promo", ...LaunchPromo }                              — the grand opening promotion
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { THEMES } from "@/lib/theme";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("theme"), theme: z.string().refine((t) => t in THEMES) }),
  z.object({
    action: z.literal("promo"), enabled: z.boolean(), start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), days: z.number().int().min(1).max(365),
    pct: z.number().min(0.01).max(0.5), fullDiscount: z.boolean().optional(),
  }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (v?.role !== "admin") return deny(403, "Admins only");
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check the settings");
  const { action, ...value } = b.data;
  const key = action === "theme" ? "site_theme" : "launch_promo";
  const { error } = await adminClient().from("site_settings").upsert({ key, value, updated_at: new Date().toISOString(), updated_by: v.email });
  return error ? deny(500, /site_settings/.test(error.message) ? "Run the site settings SQL first (see the page)" : error.message) : Response.json({ ok: true });
}
