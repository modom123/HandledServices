/*
 * FILE    : apps/web/app/api/cron/leads/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_0209 UTC
 * PURPOSE : Vercel cron (daily, mid-morning Detroit time) — the pro lead engine: find pros where
 *           we're short, find their contact email on their own site, send the next invitation step.
 *           Off until switched on in Hub → Pro leads.
 * UPDATED : 2026-10-04_1934 UTC — also runs the business sales engine (Hub → Business leads).
 * UPDATED : 2026-10-06_0726 UTC — security: cronAuthorized() (fails closed without a 16+ character CRON_SECRET, constant-time).
 * UPDATED : 2026-11-20_0130 UTC — daily: alerts (critical, emailed) when the 10-minute job hasn't run for an hour.
 */
import { leadEngine } from "@/lib/leads";
import { bizLeadEngine } from "@/lib/biz-leads";
import { cronAuthorized } from "@/lib/cron-auth";
import { adminClient } from "@/lib/supabase/server";
import { raiseAlert } from "@/lib/jobs";

export const maxDuration = 300;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  const pros = await leadEngine().catch((e) => ({ error: String(e) }));
  const business = await bizLeadEngine().catch((e) => ({ error: String(e) })); // demand side: business sales engine
  // the 10-minute job (GitHub Actions) sends outreach and campaigns all day: say so if it has stopped
  const { data: beat } = await adminClient().from("site_settings").select("value").eq("key", "cron_dispatch").maybeSingle();
  const at = (beat?.value as { at?: string } | null)?.at;
  if (!at || Date.now() - new Date(at).getTime() > 60 * 60000)
    await raiseAlert("sales", "critical", "The 10-minute job has stopped", `Outreach, campaigns, reply checks and job re-dispatch run every 10 minutes from GitHub Actions (Dispatch cron). Last run: ${at ?? "never"}. In GitHub → Actions → Dispatch cron, check it's enabled and passing.`);
  return Response.json({ pros, business });
}
