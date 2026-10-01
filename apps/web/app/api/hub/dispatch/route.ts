/*
 * FILE    : apps/web/app/api/hub/dispatch/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Staff: run AI dispatch for a job (send offers to the best pros).
 */
import { z } from "zod";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { addEvent, dispatchJob } from "@/lib/jobs";

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const body = z.object({ jobId: z.string().uuid(), siteVisit: z.boolean().optional() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return deny(400, "jobId required");
  await addEvent(body.data.jobId, "human_touch", "Manual dispatch", v!.fullName ?? v!.email, false);
  try {
    return Response.json(await dispatchJob(body.data.jobId, { siteVisit: body.data.siteVisit }));
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
