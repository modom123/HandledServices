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
 * UPDATED : 2026-10-20_0100 UTC — publishes approved social posts when their time comes (Facebook, Instagram).
 * UPDATED : 2026-10-20_0200 UTC — request-a-quote sweep (expire 24-hour invites, ask the next pros).
 */
import { redispatchExpired } from "@/lib/jobs";
import { coverageSweep } from "@/lib/coverage";
import { runEmailCenter } from "@/lib/email-center";
import { publishDue } from "@/lib/social";
import { quoteSweep } from "@/lib/quotes";
import { cronAuthorized } from "@/lib/cron-auth";

export const maxDuration = 120;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  const dispatch = await redispatchExpired();
  const coverage = await coverageSweep().catch((e) => { console.error("[coverage]", e); return null; }); // backups #1–#3, uncovered jobs
  const email = await runEmailCenter().catch((e) => { console.error("[email center]", e); return null; });
  const social = await publishDue().catch((e) => { console.error("[social]", e); return null; }); // approved posts whose time has come
  const quotes = await quoteSweep().catch((e) => { console.error("[quotes]", e); return null; }); // 24-hour quote invites
  return Response.json({ ...dispatch, coverage, email, social, quotes });
}
