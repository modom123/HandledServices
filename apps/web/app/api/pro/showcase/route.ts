/*
 * FILE    : apps/web/app/api/pro/showcase/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-10_2000 UTC
 * PURPOSE : A pro turns "Feature me on the website" on or off (Pro portal → My info). POST { on: boolean }.
 *           Opted-in, approved pros appear in "New pros in the Handled Network" (photo, name, area, up to 5 services;
 *           core pro-showcase.ts). The public chain refreshes every 6 hours; turning it off also clears it right away.
 * UPDATED : 2026-11-13_1900 UTC — turning it on also shows the pro right away (it used to wait for the 6-hour refresh).
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { refreshShowcase } from "@/lib/showcase";

const Body = z.object({ on: z.boolean() });

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return deny(400, "Say on or off");
  const { error } = await adminClient().from("contractors").update({ showcase_opt_in: p.data.on, showcase_opt_in_at: p.data.on ? new Date().toISOString() : null }).eq("id", v.contractorId);
  if (error) return deny(500, /showcase_opt_in/.test(error.message) ? "This isn't switched on yet. Ask Handled to run supabase/setup/ADD_PRO_SHOWCASE_2026-11-10_2000.sql." : error.message);
  // on or off: the website chain updates right away, not in 6 hours
  refreshShowcase();
  return Response.json({ ok: true, on: p.data.on });
}
