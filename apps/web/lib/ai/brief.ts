/*
 * FILE    : apps/web/lib/ai/brief.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Daily AI operations brief (Vercel cron, 12:00 UTC). Summarizes yesterday,
 *           today's schedule, risks and the top actions for the team. Saved as an
 *           ops alert and emailed to OPS_EMAIL.
 * UPDATED : 2026-10-06_0752 UTC — measured against the $100M plan every day, onboarding and new jobs first: pace (revenue run-rate vs this plan year's
 *           target), today's Growth plan, and progress on every open agent task; actions ranked by impact on the goal.
 */
import "server-only";
import { z } from "zod";
import { BRAND } from "@handled/core";
import { structured } from "./client";
import { adminClient } from "../supabase/server";
import { loadCityScorecard } from "../city-scorecard";
import { openAgentTasks, taskLine } from "./agent-tasks";
import { loadFunnels } from "./growth-planner";

const BriefSchema = z.object({
  headline: z.string(),
  onboarding: z.string().describe("One line: pros onboarded / applications / who is waiting — priority #1"),
  new_jobs: z.string().describe("One line: new bookings, sources and business wins — priority #2"),
  pace: z.string().describe("Revenue (our take) run-rate vs this plan year's target, as a % of pace, in one line"),
  agent_tasks: z.array(z.string()).describe("One line per open agent task: agent, task, progress from the data (or 'no data yet')"),
  yesterday: z.array(z.string()),
  today: z.array(z.string()),
  risks: z.array(z.string()),
  actions: z.array(z.string()).describe("Top 3-5 things the team should do today, ranked by impact on the $100M plan, most important first"),
});
export type Brief = z.infer<typeof BriefSchema>;

export async function buildDailyBrief(growthPlan: string | null = null): Promise<Brief | null> {
  const db = adminClient();
  const today = new Date().toISOString().slice(0, 10);
  const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const [created, todayJobs, open, alerts, apps, reviews, score, tasks, funnels] = await Promise.all([
    db.from("jobs").select("ref, service_slug, status, price_final, estimate_low, source").gte("created_at", y).lt("created_at", today),
    db.from("jobs").select("ref, service_slug, status, time_window, contractor_id, zip").eq("scheduled_date", today),
    db.from("jobs").select("ref, service_slug, status, scheduled_date, created_at").in("status", ["requested", "site_visit", "quoted", "scheduled", "dispatched", "qa_review"]),
    db.from("ops_alerts").select("severity, title").eq("resolved", false).limit(30),
    db.from("contractor_applications").select("business_name, trades, status").eq("status", "new"),
    db.from("reviews").select("rating, comment").gte("created_at", y),
    loadCityScorecard().catch(() => null),
    openAgentTasks(true),
    loadFunnels().catch(() => null),
  ]);
  const pace = score?.pace;
  return structured({
    kind: "daily_brief",
    schema: BriefSchema,
    system: `You write the morning operations brief for ${BRAND.name}'s owner and dispatch team. Lead with the two priorities — onboarding pros and winning new jobs — then the rest. Be specific (job refs, counts, dollars). No fluff.`,
    content: JSON.stringify({
      date: today,
      bookings_yesterday: created.data, schedule_today: todayJobs.data, open_pipeline: open.data,
      unresolved_alerts: alerts.data, new_pro_applications: apps.data, reviews_yesterday: reviews.data,
      plan_pace: pace ? { plan_year: pace.year, phase: pace.plan.phase, revenue_target: pace.plan.revenue, take_run_rate: Math.round(pace.takeRunRate), pace_pct: Math.round(pace.takePace * 100) } : "no data yet",
      funnels, todays_growth_plan: growthPlan, open_agent_tasks: tasks.map((t) => ({ agent: t.agent, task: taskLine(t), by: t.created_by })),
    }),
    effort: "medium",
  });
}
