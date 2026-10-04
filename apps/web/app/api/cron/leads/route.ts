/*
 * FILE    : apps/web/app/api/cron/leads/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0209 UTC
 * PURPOSE : Vercel cron (daily, mid-morning Detroit time) — the pro lead engine: find pros where
 *           we're short, find their contact email on their own site, send the next invitation step.
 *           Off until switched on in Hub → Pro leads.
 * UPDATED : 2026-10-04_1934 UTC — also runs the business sales engine (Hub → Business leads).
 */
import { leadEngine } from "@/lib/leads";
import { bizLeadEngine } from "@/lib/biz-leads";

export const maxDuration = 300;

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("Unauthorized", { status: 401 });
  const pros = await leadEngine().catch((e) => ({ error: String(e) }));
  const business = await bizLeadEngine().catch((e) => ({ error: String(e) })); // demand side: business sales engine
  return Response.json({ pros, business });
}
