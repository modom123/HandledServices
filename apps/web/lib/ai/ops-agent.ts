/*
 * FILE    : apps/web/lib/ai/ops-agent.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : The AI operations assistant inside the ops hub. Staff ask in plain English
 *           ("what's unassigned for tomorrow?", "re-dispatch H-1042", "who are our best
 *           gutter pros?") and Claude answers from live Supabase data, taking a small
 *           set of reversible actions. Staff-only (checked in the route).
 * UPDATED : 2026-10-06_0752 UTC — runs with the $100M mission and its tasks; new tools: growth_status (plan pace plus the
 *           onboarding and new-jobs funnels), list_agent_tasks, assign_agent_task and close_agent_task, so staff can
 *           say "have the concierge push move-out cleans this week" and it's assigned.
 */
import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { AGENTS, BRAND, JOB_STATUSES } from "@handled/core";
import { FALLBACK, MODEL, aiEnabled, anthropic, logRun } from "./client";
import { adminClient } from "../supabase/server";
import { addEvent, dispatchJob, raiseAlert, setStatus } from "../jobs";
import { assignTask, closeTask, openAgentTasks, systemFor, taskLine } from "./agent-tasks";
import { loadFunnels } from "./growth-planner";
import { loadCityScorecard } from "../city-scorecard";

const db = () => adminClient();
const JOB_COLS = "id, ref, status, service_slug, contact_name, city, zip, scheduled_date, time_window, estimate_low, estimate_high, price_final, contractor_id, priority, customer_type, created_at";

function tools(actor: string) {
  return [
    betaZodTool({
      name: "find_jobs",
      description: "Search jobs. All filters optional. Returns up to 50 rows, newest first.",
      inputSchema: z.object({
        status: z.array(z.enum(JOB_STATUSES)).optional(),
        service_slug: z.string().optional(),
        date_from: z.string().optional().describe("YYYY-MM-DD scheduled_date lower bound"),
        date_to: z.string().optional(),
        unassigned_only: z.boolean().optional(),
        ref: z.string().optional(),
      }),
      run: async (f) => {
        let q = db().from("jobs").select(JOB_COLS).order("created_at", { ascending: false }).limit(50);
        if (f.status?.length) q = q.in("status", f.status);
        if (f.service_slug) q = q.eq("service_slug", f.service_slug);
        if (f.date_from) q = q.gte("scheduled_date", f.date_from);
        if (f.date_to) q = q.lte("scheduled_date", f.date_to);
        if (f.unassigned_only) q = q.is("contractor_id", null);
        if (f.ref) q = q.eq("ref", f.ref.toUpperCase());
        const { data, error } = await q;
        return error ? error.message : JSON.stringify(data);
      },
    }),
    betaZodTool({
      name: "job_detail",
      description: "Full detail for one job by ref (e.g. H-1042): answers, notes, AI quote/dispatch/QA, offers and timeline.",
      inputSchema: z.object({ ref: z.string() }),
      run: async ({ ref }) => {
        const { data: job } = await db().from("jobs").select("*").eq("ref", ref.toUpperCase()).maybeSingle();
        if (!job) return "No such job";
        const [{ data: offers }, { data: events }] = await Promise.all([
          db().from("job_offers").select("status, payout, ai_score, ai_reason, contractors(business_name)").eq("job_id", job.id),
          db().from("job_events").select("kind, message, created_at").eq("job_id", job.id).order("created_at"),
        ]);
        return JSON.stringify({ job, offers, events });
      },
    }),
    betaZodTool({
      name: "find_pros",
      description: "List subcontractors with performance stats, optionally by trade or status.",
      inputSchema: z.object({ trade: z.string().optional(), status: z.enum(["applied", "vetting", "approved", "suspended"]).optional() }),
      run: async ({ trade, status }) => {
        let q = db().from("contractors").select("id, business_name, trades, status, rating, jobs_completed, acceptance_rate, on_time_rate, insured_until, daily_capacity").order("rating", { ascending: false });
        if (trade) q = q.contains("trades", [trade]);
        if (status) q = q.eq("status", status);
        const { data } = await q;
        return JSON.stringify(data);
      },
    }),
    betaZodTool({
      name: "metrics",
      description: "Gross bookings (what customers paid), paid to pros, our take, job counts and average rating between two dates (by created_at).",
      inputSchema: z.object({ from: z.string(), to: z.string() }),
      run: async ({ from, to }) => {
        const { data: jobs } = await db().from("jobs").select("status, price_final, contractor_payout, service_slug").gte("created_at", from).lte("created_at", `${to}T23:59:59`);
        const { data: reviews } = await db().from("reviews").select("rating").gte("created_at", from).lte("created_at", `${to}T23:59:59`);
        const done = (jobs ?? []).filter((j) => j.status === "completed");
        const revenue = done.reduce((t, j) => t + Number(j.price_final ?? 0), 0);
        const payouts = done.reduce((t, j) => t + Number(j.contractor_payout ?? 0), 0);
        const byService: Record<string, number> = {};
        for (const j of jobs ?? []) byService[j.service_slug] = (byService[j.service_slug] ?? 0) + 1;
        return JSON.stringify({
          bookings: jobs?.length ?? 0, completed: done.length, gross_bookings: revenue, paid_to_pros: payouts, our_take: revenue - payouts,
          avg_rating: reviews?.length ? reviews.reduce((t, r) => t + r.rating, 0) / reviews.length : null, by_service: byService,
        });
      },
    }),
    betaZodTool({
      name: "redispatch_job",
      description: "Send (or re-send) offers for a job to the best available pros. Use when a job is unassigned.",
      inputSchema: z.object({ ref: z.string() }),
      run: async ({ ref }) => {
        const { data: job } = await db().from("jobs").select("id, contractor_id").eq("ref", ref.toUpperCase()).maybeSingle();
        if (!job) return "No such job";
        if (job.contractor_id) return "Job already has a pro assigned";
        await addEvent(job.id, "human_touch", "Re-dispatch requested via AI assistant", actor, false);
        return JSON.stringify(await dispatchJob(job.id));
      },
    }),
    betaZodTool({
      name: "set_job_status",
      description: "Change a job's status (e.g. cancel, mark quoted after a site visit). Logged with the staff member's name.",
      inputSchema: z.object({ ref: z.string(), status: z.enum(JOB_STATUSES) }),
      run: async ({ ref, status }) => {
        const { data: job } = await db().from("jobs").select("id").eq("ref", ref.toUpperCase()).maybeSingle();
        if (!job) return "No such job";
        await setStatus(job.id, status, `${actor} via AI assistant`);
        return `Status for ${ref} set to ${status}`;
      },
    }),
    betaZodTool({
      name: "growth_status",
      description: "Where we stand on the $100M plan: plan year, revenue (our take) run-rate vs target, plus the two priority funnels — onboarding pros and winning new jobs.",
      inputSchema: z.object({}),
      run: async () => {
        const [score, funnels] = await Promise.all([loadCityScorecard().catch(() => null), loadFunnels().catch(() => null)]);
        const p = score?.pace;
        return JSON.stringify({ pace: p ? { year: p.year, phase: p.plan.phase, target: p.plan.revenue, take_run_rate: Math.round(p.takeRunRate), pace_pct: Math.round(p.takePace * 100) } : "no data yet", funnels });
      },
    }),
    betaZodTool({
      name: "list_agent_tasks",
      description: "Open tasks assigned to the AI agents (by staff or the Growth planner).",
      inputSchema: z.object({}),
      run: async () => JSON.stringify((await openAgentTasks(true)).map((t) => ({ id: t.id, agent: t.agent, task: taskLine(t), by: t.created_by }))),
    }),
    betaZodTool({
      name: "assign_agent_task",
      description: `Assign a task to an AI agent when the staff member asks. agent is one of: ${AGENTS.map((a) => `${a.kind} (${a.name})`).join(", ")}, or "all". The agent sees it on every run until it's closed.`,
      inputSchema: z.object({ agent: z.string(), title: z.string().min(3).max(300), target: z.string().max(200).optional(), due_date: z.string().optional().describe("YYYY-MM-DD") }),
      run: async (t) => {
        if (t.agent !== "all" && !AGENTS.some((a) => a.kind === t.agent)) return `Unknown agent ${t.agent}`;
        const row = await assignTask({ agent: t.agent, title: t.title, target: t.target ?? null, due_date: t.due_date && /^\d{4}-\d{2}-\d{2}$/.test(t.due_date) ? t.due_date : null }, actor);
        return `Assigned (id ${row.id})`;
      },
    }),
    betaZodTool({
      name: "close_agent_task",
      description: "Mark an agent task done or cancelled (by id from list_agent_tasks) when the staff member asks.",
      inputSchema: z.object({ id: z.string().uuid(), status: z.enum(["done", "cancelled"]), note: z.string().max(300).optional() }),
      run: async ({ id, status, note }) => { await closeTask(id, status, note ?? null, actor); return `Task ${status}`; },
    }),
    betaZodTool({
      name: "create_alert",
      description: "Pin a follow-up or warning to the ops dashboard.",
      inputSchema: z.object({ title: z.string(), body: z.string(), severity: z.enum(["info", "warn", "critical"]) }),
      run: async ({ title, body, severity }) => {
        await raiseAlert("assistant", severity, title, body);
        return "Alert created";
      },
    }),
  ];
}

export async function opsAssistant(history: { role: "user" | "assistant"; content: string }[], actor: string) {
  if (!aiEnabled()) return "AI is not configured — add ANTHROPIC_API_KEY in Vercel.";
  const today = new Date().toISOString().slice(0, 10);
  const messages: Anthropic.Beta.BetaMessageParam[] = history.slice(-16).map((t) => ({ role: t.role, content: t.content }));
  const runner = anthropic().beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    betas: [...FALLBACK.betas],
    output_config: { effort: "medium" },
    system: await systemFor("ops_assistant",
      `You are the operations co-pilot for ${BRAND.name}, a home & business services company that delivers every job through vetted subcontractors. ` +
      `You help dispatchers and the owner run the day from live data. Look things up with tools before answering; never guess numbers. ` +
      `You may re-dispatch, change a status or create an alert when the staff member asks — confirm what you changed. ` +
      `You may assign or close AI agent tasks when asked. Keep answers tight: short bullets, job refs, dollar figures.`),
    tools: tools(actor),
    max_iterations: 10,
    // today's date goes in the final user turn so the system prompt stays cacheable
    messages: [...messages.slice(0, -1), { role: "user", content: `(today is ${today})\n${history.at(-1)?.content ?? ""}` }],
  });
  const final = await runner;
  await logRun({ kind: "ops_assistant", input: { q: history.at(-1)?.content, actor }, usage: final.usage });
  if (final.stop_reason === "refusal") return "That request was declined by the model's safety system.";
  return final.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
}
