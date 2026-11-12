/*
 * FILE    : apps/web/app/api/pro/jobs/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-06_1900 UTC
 * PURPOSE : GET — the signed-in pro's jobs (need-to-know, lib/job-access): what they need to do the work and their NET
 *           pay. Never the job price, Handled's take or the referral split. ?status=assigned,in_progress filters.
 * UPDATED : 2026-11-13_0030 UTC — addresses and customer contact need the Pro PIN (x-pro-unlock header or cookie).
 */
import { deny, getViewer } from "@/lib/auth";
import { proJobs } from "@/lib/job-access";
import { pinUnlocked } from "@/lib/pro-pin";

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const st = new URL(req.url).searchParams.get("status");
  const jobs = await proJobs(v.contractorId, st ? st.split(",").filter((x) => /^[a-z_]+$/.test(x)).slice(0, 12) : undefined, await pinUnlocked(v.contractorId, req));
  return Response.json({ jobs }, { headers: { "Cache-Control": "no-store" } });
}
