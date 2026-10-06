/*
 * FILE    : apps/web/lib/ai/growth-planner.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-06_0752 UTC
 * PURPOSE : The Growth planner — runs every morning (cron/daily-brief) so the AI team works toward $100M every day.
 *           Reads pace against the growth plan, the last 30 days, the open pipeline and every open agent task; names
 *           the bottleneck — with the owner's two priorities first: onboarding pros and winning new jobs (loadFunnels); assigns up to 5 measurable tasks for the day to the agents that can move it, and closes its
 *           own tasks that are done or stale. Gatekeeper agents (QA, screening, documents, pricing, bids) never get
 *           growth tasks — their bar doesn't move. Saved as an ops alert; staff see and edit tasks in Hub → AI agents.
 */
import "server-only";
import { z } from "zod";
import { AGENTS, MISSION, money } from "@handled/core";
import { structured } from "./client";
import { adminClient } from "../supabase/server";
import { loadCityScorecard } from "../city-scorecard";
import { assignTask, closeTask, openAgentTasks, taskLine } from "./agent-tasks";

export const PLANNER = "Growth planner";
const ASSIGNABLE = AGENTS.filter((a) => !a.gate && a.kind !== "growth_planner").map((a) => a.kind);

const countBy = (rows: { status: string }[] | null) => (rows ?? []).reduce<Record<string, number>>((t, r) => ({ ...t, [r.status]: (t[r.status] ?? 0) + 1 }), {});

/** The two funnels that matter most right now: onboarding pros and winning new jobs (last 30 days + current state). */
export async function loadFunnels() {
  const db = adminClient();
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const stuck = new Date(Date.now() - 3 * 86400000).toISOString();
  const [{ data: proLeads }, { data: apps }, { data: pros }, { data: stuckApps }, { data: bizLeads }, { data: jobs }, { data: chats }] = await Promise.all([
    db.from("pro_leads").select("status").gte("created_at", since30).limit(20000),
    db.from("contractor_applications").select("status").gte("created_at", since30).limit(5000),
    db.from("contractors").select("status, created_at").limit(20000),
    db.from("contractor_applications").select("business_name, created_at").in("status", ["new", "reviewing"]).lt("created_at", stuck).limit(20),
    db.from("biz_leads").select("status").gte("created_at", since30).limit(20000),
    db.from("jobs").select("source, status, contact_email, customer_type").gte("created_at", since30).limit(20000),
    db.from("ai_runs").select("id").eq("kind", "concierge").gte("created_at", since30).limit(20000),
  ]);
  const p = (pros ?? []) as { status: string; created_at: string }[];
  const j = (jobs ?? []) as { source: string; status: string; contact_email: string | null; customer_type: string }[];
  return {
    onboarding: {
      recruiting_leads_30d: countBy(proLeads as { status: string }[]), applications_30d: countBy(apps as { status: string }[]),
      applications_waiting_3_days_plus: (stuckApps ?? []).map((a) => a.business_name),
      pros_now: countBy(p), pros_added_30d: p.filter((x) => x.created_at >= since30).length,
    },
    new_jobs: {
      bookings_30d: j.length, by_source: j.reduce<Record<string, number>>((t, x) => ({ ...t, [x.source]: (t[x.source] ?? 0) + 1 }), {}),
      business_bookings_30d: j.filter((x) => x.customer_type === "commercial").length,
      concierge_chats_30d: chats?.length ?? 0, business_leads_30d: countBy(bizLeads as { status: string }[]),
    },
  };
}

const PlanSchema = z.object({
  scoreboard: z.string().describe("One line: revenue (our take) run-rate vs this plan year's target, % of pace, and the trend"),
  bottleneck: z.string().describe("The single biggest thing holding growth back right now, with the number that shows it"),
  assignments: z.array(z.object({
    agent: z.string().describe(`One of: ${ASSIGNABLE.join(", ")}`),
    title: z.string().describe("A specific action the agent can take in its own job, starting with a verb"),
    target: z.string().describe("A measurable target, e.g. '10 booking links today' or 'offers accepted within 30 min'"),
    due_in_days: z.number().int().min(1).max(14),
  })).max(5),
  close: z.array(z.object({ id: z.string(), status: z.enum(["done", "cancelled"]), reason: z.string() })).describe("Open tasks (by id) to close: met, or no longer relevant"),
  owner_actions: z.array(z.string()).max(3).describe("Up to 3 things only a human can do today for onboarding or new jobs (approve waiting applicants, call a business lead, sign a contract)"),
});
export type GrowthPlan = z.infer<typeof PlanSchema>;

export async function runGrowthPlanner() {
  const db = adminClient();
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const [score, tasks, funnels, { data: jobs }, { data: unassigned }, { data: leads }, { data: plans }, { data: members }] = await Promise.all([
    loadCityScorecard().catch(() => null),
    openAgentTasks(true),
    loadFunnels().catch(() => null),
    db.from("jobs").select("service_slug, status, price_final, contractor_payout, customer_type, source, created_at").gte("created_at", since30).limit(20000),
    db.from("jobs").select("ref, service_slug, scheduled_date").is("contractor_id", null).in("status", ["scheduled", "dispatched"]).limit(50),
    db.from("leads").select("source, created_at").gte("created_at", since30).limit(5000),
    db.from("recurring_plans").select("active, created_at").limit(20000),
    db.from("memberships").select("status").limit(20000),
  ]);
  const j = jobs ?? [];
  const done = j.filter((x) => x.status === "completed");
  const take = done.reduce((t, x) => t + Number(x.price_final ?? 0) - Number(x.contractor_payout ?? 0), 0);
  const bySvc: Record<string, number> = {};
  for (const x of j) bySvc[x.service_slug] = (bySvc[x.service_slug] ?? 0) + 1;
  const pace = score?.pace;
  const plan = await structured({
    kind: "growth_planner",
    schema: PlanSchema,
    system: "You are the Growth planner. The owner's two priorities come first: ONBOARDING PROS and WINNING NEW JOBS — most of today's tasks should move one of those two funnels (use the funnel numbers). " +
      "Use only the numbers given; if data is thin (early days), say so and assign tasks that create the first data: bookings, pros and reviews. " +
      `Assign only to these agents: ${AGENTS.filter((a) => ASSIGNABLE.includes(a.kind)).map((a) => `${a.kind} (${a.does})`).join("; ")}. ` +
      "Never assign anything that lowers prices below the engine, pressures pros to accept work, or changes vetting, QA, pricing or compliance standards. " +
      "Do not duplicate an open task. Close only tasks listed as open, by their id.",
    content: JSON.stringify({
      today: new Date().toISOString().slice(0, 10),
      plan_year: pace ? { year: pace.year, phase: pace.plan.phase, revenue_target: pace.plan.revenue, take_run_rate: Math.round(pace.takeRunRate), pace_pct: Math.round(pace.takePace * 100), bookings_run_rate: Math.round(pace.bookingsRunRate), metros_target: pace.plan.metros, ai_driven_target: pace.aiTarget } : "no data yet",
      cities: score?.cards.filter((c) => c.market.active).map((c) => ({ city: c.market.name, stage: c.score.stage, next: c.score.todo.slice(0, 3).map((g) => `${g.label} ${g.value} (target ${g.target})`) })) ?? [],
      last_30_days: { bookings: j.length, completed: done.length, take: Math.round(take), by_service: bySvc, business_share: j.length ? Math.round((j.filter((x) => x.customer_type === "commercial").length / j.length) * 100) : 0 },
      unassigned_jobs: unassigned ?? [], leads_30d: { total: leads?.length ?? 0, by_source: (leads ?? []).reduce<Record<string, number>>((t, l) => ({ ...t, [l.source]: (t[l.source] ?? 0) + 1 }), {}) },
      recurring_plans_active: (plans ?? []).filter((p) => p.active).length, plus_members_active: (members ?? []).filter((m) => m.status === "active").length,
      open_tasks: tasks.map((t) => ({ id: t.id, agent: t.agent, task: taskLine(t), by: t.created_by, opened: t.created_at.slice(0, 10) })),
      funnels,
      mission: { priorities: MISSION.priorities, goal: MISSION.goal, milestones: MISSION.milestones, focus: MISSION.focus },
    }),
    effort: "medium",
  });
  if (!plan) return null;
  const openIds = new Set(tasks.map((t) => t.id));
  let closed = 0, assigned = 0;
  for (const c of plan.close) if (openIds.has(c.id)) { await closeTask(c.id, c.status, c.reason.slice(0, 300), PLANNER).catch(() => null); closed++; }
  // its own tasks past due close themselves, so the list never fills with stale work
  const today = new Date().toISOString().slice(0, 10);
  for (const t of tasks) if (t.created_by === PLANNER && t.due_date && t.due_date < today && !plan.close.some((c) => c.id === t.id)) { await closeTask(t.id, "cancelled", "Past due — replanned", PLANNER).catch(() => null); closed++; }
  const have = new Set(tasks.map((t) => `${t.agent}|${t.title.trim().toLowerCase()}`));
  for (const a of plan.assignments) {
    if (!ASSIGNABLE.includes(a.agent) || have.has(`${a.agent}|${a.title.trim().toLowerCase()}`)) continue;
    const due = new Date(Date.now() + a.due_in_days * 86400000).toISOString().slice(0, 10);
    await assignTask({ agent: a.agent, title: a.title.slice(0, 300), target: a.target.slice(0, 200), due_date: due }, PLANNER).then(() => assigned++).catch(() => null);
  }
  const body = [`Scoreboard: ${plan.scoreboard}`, `Bottleneck: ${plan.bottleneck}`,
    `Assigned today:\n${plan.assignments.filter((a) => ASSIGNABLE.includes(a.agent)).map((a) => `- ${AGENTS.find((x) => x.kind === a.agent)?.name}: ${a.title} (target: ${a.target})`).join("\n") || "- none"}`,
    plan.owner_actions.length ? `For the owner:\n${plan.owner_actions.map((x) => `- ${x}`).join("\n")}` : "",
    funnels ? `Onboarding (30d): ${funnels.onboarding.pros_added_30d} pros added; applications ${JSON.stringify(funnels.onboarding.applications_30d)}; ${funnels.onboarding.applications_waiting_3_days_plus.length} waiting 3+ days.` : "",
    funnels ? `New jobs (30d): ${funnels.new_jobs.bookings_30d} bookings (${funnels.new_jobs.business_bookings_30d} business), ${funnels.new_jobs.concierge_chats_30d} concierge chats.` : "",
    `Last 30 days: ${j.length} bookings, ${done.length} completed, ${money(take)} kept.`].filter(Boolean).join("\n\n");
  await db.from("ops_alerts").insert({ kind: "growth_plan", severity: "info", title: `Growth plan: ${plan.bottleneck.slice(0, 120)}`, body });
  return { plan, assigned, closed, body };
}
