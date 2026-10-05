/*
 * FILE    : apps/web/app/api/cron/gov/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_1441 UTC
 * PURPOSE : Vercel cron (weekdays, morning Detroit time) — runs the saved SAM.gov search (Hub → Gov contracts) inside
 *           the daily call budget and caches new government contract opportunities. Off until switched on.
 */
import { govEngine } from "@/lib/gov";

export const maxDuration = 300;

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("Unauthorized", { status: 401 });
  return Response.json(await govEngine().catch((e) => ({ error: String(e) })));
}
