/*
 * FILE    : apps/web/app/api/cron/dispatch/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : Every 10 minutes: offers nobody answered expire and the job goes to the next pros,
 *           so same-day and ASAP work never waits for the daily sweep. Needs Vercel Pro (Hobby
 *           allows daily crons only — and doesn't allow commercial use).
 * UPDATED : 2026-10-05_0148 UTC — also sends the next small batch of Email Center campaigns (within the daily cap).
 */
import { redispatchExpired } from "@/lib/jobs";
import { runEmailCenter } from "@/lib/email-center";

export const maxDuration = 120;

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("Unauthorized", { status: 401 });
  const dispatch = await redispatchExpired();
  const email = await runEmailCenter().catch((e) => { console.error("[email center]", e); return null; });
  return Response.json({ ...dispatch, email });
}
