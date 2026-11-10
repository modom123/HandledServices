/*
 * FILE    : apps/web/app/hub/briefing/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-14_2330 UTC
 * PURPOSE : Mastermind → Daily Briefing: what needs attention today — the AI morning brief, open alerts, today's
 *           schedule and the queues waiting on a person (jobs without a pro, QA, IEBC approvals, new pro applications).
 *           Moved off the Dashboard, which is now stats and insights only (app/hub/page.tsx).
 * UPDATED : 2026-10-15_0010 UTC — pro candidates waiting on a decision (screened or interviewed) lead the queues.
 * UPDATED : 2026-10-27_1700 UTC — candidates to decide → Recruiting → Pipeline.
 * UPDATED : 2026-11-06_1900 UTC — need-to-know: read on the server; money (pro pay, our take, payouts, partner splits) for admins only.
 * UPDATED : 2026-11-10_0330 UTC — shorter, scannable layout: only the queues that need someone (chips); the AI brief as
 *           today's top actions + three one-liners, every other brief section folded; urgent alerts first (two lines
 *           each), the rest folded; today's schedule as a compact list by arrival window with "needs a pro" flagged.
 */
import type { Job } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { pipeline } from "@/lib/recruiting";
import { adminClient } from "@/lib/supabase/server";
import BriefingView, { type Alert } from "@/components/hub-views/BriefingView";

export const metadata = { title: "Daily Briefing" };

export default async function Briefing() {
  const v = await getViewer();
  if (!v) return null;
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: todays }, { data: alerts }, { data: open }, { count: apps }, { count: iebcPending }, funnel] = await Promise.all([
    adminClient().from("jobs").select("*").eq("scheduled_date", today).order("time_window"),
    v.db.from("ops_alerts").select("*").eq("resolved", false).order("created_at", { ascending: false }).limit(50),
    adminClient().from("jobs").select("status, contractor_id").not("status", "in", "(completed,cancelled)"),
    v.db.from("contractor_applications").select("id", { count: "exact", head: true }).eq("status", "new"),
    v.db.from("agent_actions").select("id", { count: "exact", head: true }).eq("status", "pending_approval"),
    pipeline(),
  ]);
  return <BriefingView funnel={funnel} open={(open ?? []) as { status: string; contractor_id: string | null }[]} alerts={(alerts ?? []) as Alert[]} todays={(todays ?? []) as Job[]} apps={apps ?? 0} iebcPending={iebcPending ?? 0} />;
}
