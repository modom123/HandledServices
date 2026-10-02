/*
 * FILE    : apps/web/app/api/account/jobs/[id]/reschedule/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : Customer: move my booking to another open day and arrival window.
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { rescheduleJob } from "@/lib/visit";

const Body = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), window: z.enum(["morning", "midday", "afternoon", "flexible"]) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in first");
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Pick a date and time");
  const r = await rescheduleJob((await params).id, v.userId, b.data.date, b.data.window);
  return r.ok ? Response.json(r) : deny(409, r.error!);
}
