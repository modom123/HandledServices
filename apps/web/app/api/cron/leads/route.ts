/*
 * FILE    : apps/web/app/api/cron/leads/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0209 UTC
 * PURPOSE : Vercel cron (daily, mid-morning Detroit time) — the pro lead engine: find pros where
 *           we're short, find their contact email on their own site, send the next invitation step.
 *           Off until switched on in Hub → Pro leads.
 */
import { leadEngine } from "@/lib/leads";

export const maxDuration = 300;

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("Unauthorized", { status: 401 });
  return Response.json(await leadEngine());
}
