/*
 * FILE    : apps/web/app/api/hub/jobs/[id]/no-show/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0123 UTC
 * PURPOSE : Staff record a pro no-show (after checking with the customer): the job goes back out
 *           and the no-show counts toward the Pro Deactivation Policy thresholds. POST { note }.
 */
import { z } from "zod";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { markNoShow } from "@/lib/standing";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const b = z.object({ note: z.string().trim().min(5).max(1000) }).safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Say what happened (the pro sees it)");
  const r = await markNoShow((await ctx.params).id, v!.email, b.data.note);
  return r.ok ? Response.json(r) : deny(409, r.error);
}
