/*
 * FILE    : apps/web/app/api/hub/site/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0250 UTC
 * PURPOSE : Hub → Website (admins). POST JSON:
 *             { action: "theme", theme: "classic" | "greengold" | "modern" | "bwg" } — the default website look
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { THEMES } from "@/lib/theme";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("theme"), theme: z.string().refine((t) => t in THEMES) }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (v?.role !== "admin") return deny(403, "Admins only");
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check the settings");
  const { action: _action, ...value } = b.data;
  const key = "site_theme";
  const { error } = await adminClient().from("site_settings").upsert({ key, value, updated_at: new Date().toISOString(), updated_by: v.email });
  return error ? deny(500, /site_settings/.test(error.message) ? "Run the site settings SQL first (see the page)" : error.message) : Response.json({ ok: true });
}
