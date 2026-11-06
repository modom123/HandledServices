/*
 * FILE    : apps/web/app/api/account/jobs/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-06_1900 UTC
 * PURPOSE : GET — the signed-in customer's bookings (need-to-know, lib/job-access): their jobs and prices, never pro
 *           pay, referral partner data or internal AI notes. Replaces the app's direct database read of jobs.
 */
import { deny, getViewer } from "@/lib/auth";
import { customerJobs } from "@/lib/job-access";

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in first");
  return Response.json({ jobs: await customerJobs(v.userId) }, { headers: { "Cache-Control": "no-store" } });
}
