/*
 * FILE    : apps/web/app/api/cron/dispatch/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : Every 10 minutes: offers nobody answered expire and the job goes to the next pros,
 *           so same-day and ASAP work never waits for the daily sweep. Needs Vercel Pro (Hobby
 *           allows daily crons only — and doesn't allow commercial use).
 */
import { redispatchExpired } from "@/lib/jobs";

export const maxDuration = 120;

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("Unauthorized", { status: 401 });
  return Response.json(await redispatchExpired());
}
