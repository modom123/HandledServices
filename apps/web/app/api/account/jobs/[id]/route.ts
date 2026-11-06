/*
 * FILE    : apps/web/app/api/account/jobs/[id]/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-06_1900 UTC
 * PURPOSE : GET — one of the signed-in customer's bookings and its customer-facing timeline (need-to-know,
 *           lib/job-access). Replaces the app's direct database reads of jobs and job_events.
 */
import { deny, getViewer } from "@/lib/auth";
import { customerEvents, customerJob } from "@/lib/job-access";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in first");
  const { id } = await params;
  const job = await customerJob(v.userId, id);
  if (!job) return deny(404, "Not found");
  return Response.json({ job, events: await customerEvents(v.userId, id) }, { headers: { "Cache-Control": "no-store" } });
}
