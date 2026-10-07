/*
 * FILE    : apps/web/app/api/cron/dispatch/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : Every 10 minutes: offers nobody answered expire and the job goes to the next pros,
 *           so same-day and ASAP work never waits for the daily sweep.
 * UPDATED : 2026-10-05_0148 UTC — also sends the next small batch of Email Center campaigns (within the daily cap).
 * UPDATED : 2026-10-06_0523 UTC — scheduled by GitHub Actions (.github/workflows/dispatch-cron_*.yml), not
 *           Vercel: Hobby only allows daily crons. Same CRON_SECRET bearer check.
 * UPDATED : 2026-10-06_1950 UTC — coverage sweep: fills backups #1–#3 for the next 3 days; flags jobs within 6h with no pro.
 * UPDATED : 2026-10-06_0726 UTC — security: cronAuthorized() (fails closed without a 16+ character CRON_SECRET, constant-time).
 */
import { redispatchExpired } from "@/lib/jobs";
import { coverageSweep } from "@/lib/coverage";
import { runEmailCenter } from "@/lib/email-center";
import { cronAuthorized } from "@/lib/cron-auth";

export const maxDuration = 120;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  const dispatch = await redispatchExpired();
  const coverage = await coverageSweep().catch((e) => { console.error("[coverage]", e); return null; }); // backups #1–#3, uncovered jobs
  const email = await runEmailCenter().catch((e) => { console.error("[email center]", e); return null; });
  return Response.json({ ...dispatch, coverage, email });
}
