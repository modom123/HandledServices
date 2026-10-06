/*
 * FILE    : apps/web/app/api/cron/gov/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_1441 UTC
 * PURPOSE : Vercel cron (weekdays, morning Detroit time) — runs the saved SAM.gov search (Hub → Gov contracts) inside
 *           the daily call budget and caches new government contract opportunities. Off until switched on.
 * UPDATED : 2026-10-06_0726 UTC — security: cronAuthorized() (fails closed without a 16+ character CRON_SECRET, constant-time).
 */
import { govEngine } from "@/lib/gov";
import { cronAuthorized } from "@/lib/cron-auth";

export const maxDuration = 300;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  return Response.json(await govEngine().catch((e) => ({ error: String(e) })));
}
