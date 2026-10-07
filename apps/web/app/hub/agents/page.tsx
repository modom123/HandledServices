/*
 * FILE    : apps/web/app/hub/agents/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-06_0752 UTC
 * PURPOSE : Hub → AI agents: proof the AI team is working toward $100M every day. The mission and the two priorities
 *           (onboard pros, win new jobs); today's Growth plan; for every agent: what it does, when it runs, whether it's
 *           working (runs and success rate in the last 7 days, last run), its standing tasks and the tasks assigned to
 *           it; assign a task to any agent; run the Growth planner now.
 */
import { AGENTS, MISSION } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { aiEnabled } from "@/lib/ai/client";
import { taskLine, type AgentTask } from "@/lib/ai/agent-tasks";
import { Badge, Stat } from "@/components/ui";
import { AssignTask, RunPlanner, TaskActions } from "@/components/AgentTasks";

export const dynamic = "force-dynamic";

const ago = (iso: string | null) => {
  if (!iso) return "never";
  const h = (Date.now() - new Date(iso).getTime()) / 3600000;
  return h < 1 ? `${Math.max(1, Math.round(h * 60))} min ago` : h < 48 ? `${Math.round(h)} h ago` : `${Math.round(h / 24)} days ago`;
};

export default async function AgentsPage() {
  const v = await getViewer();
  if (!v) return null;
  const db = adminClient();
  const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
  const [{ data: runs }, { data: tasks }, { data: done }, { data: plan }] = await Promise.all([
    db.from("ai_runs").select("kind, ok, created_at").gte("created_at", since7).order("created_at", { ascending: false }).limit(50000),
    db.from("agent_tasks").select("*").eq("status", "open").order("created_at", { ascending: false }),
    db.from("agent_tasks").select("*").neq("status", "open").order("closed_at", { ascending: false }).limit(15),
    db.from("ops_alerts").select("title, body, created_at").eq("kind", "growth_plan").order("created_at", { ascending: false }).limit(1),
  ]);
  const r = (runs ?? []) as { kind: string; ok: boolean; created_at: string }[];
  const { data: lastRuns } = await db.from("ai_runs").select("kind, created_at").order("created_at", { ascending: false }).limit(2000);
  const last = new Map<string, string>();
  for (const x of (lastRuns ?? []) as { kind: string; created_at: string }[]) if (!last.has(x.kind)) last.set(x.kind, x.created_at);
  const open = (tasks ?? []) as AgentTask[];
  const closed = (done ?? []) as AgentTask[];
  const latest = (plan ?? [])[0] as { title: string; body: string; created_at: string } | undefined;
  const ok7 = r.filter((x) => x.ok).length;
  const working = AGENTS.filter((a) => r.some((x) => x.kind === a.kind && x.ok)).length;
  const names = AGENTS.map((a) => ({ kind: a.kind, name: a.name }));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">AI agents</h1>
          <p className="max-w-3xl text-sm text-ink-soft">Every agent runs with one mission — {MISSION.goal} ({MISSION.milestones}) — its standing tasks, and the tasks you assign here. The Growth planner sets the day’s tasks every morning at 12:00 UTC, before the brief.</p>
        </div>
        <RunPlanner />
      </div>
      {!aiEnabled() && <div className="card border-rose-300 bg-rose-50 text-sm text-rose-800"><b>AI is off.</b> Add ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables and redeploy. Until then every agent falls back to the rules engine and nothing below runs.</div>}
      <div className="card bg-brand-tint text-sm">
        <div className="font-semibold">Top priorities, every day</div>
        <ol className="mt-1 list-decimal space-y-1 pl-5">{MISSION.priorities.map((p) => <li key={p}>{p}</li>)}</ol>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Agents working (7d)" value={`${working} / ${AGENTS.length}`} hint="ran successfully at least once" />
        <Stat label="AI runs (7d)" value={r.length.toLocaleString("en-US")} hint={r.length ? `${Math.round((ok7 / r.length) * 100)}% succeeded` : "none yet"} />
        <Stat label="Open agent tasks" value={open.length} hint={`${open.filter((t) => t.created_by === "Growth planner").length} from the Growth planner`} />
        <Stat label="Last growth plan" value={latest ? ago(latest.created_at) : "never"} hint="runs daily with the morning brief" />
      </div>
      {latest && (
        <div className="card text-sm">
          <div className="flex justify-between gap-2"><div className="font-semibold">📈 Today’s growth plan</div><span className="text-xs text-ink-soft">{latest.created_at.slice(0, 16).replace("T", " ")} UTC</span></div>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-ink">{latest.body}</pre>
        </div>
      )}
      <div className="card space-y-2">
        <div className="font-semibold">Assign a task</div>
        <AssignTask agents={names} />
        <p className="text-xs text-ink-soft">The agent sees it on every run until you mark it done. Gatekeepers (pricing, QA, screening, documents, bids) only take tasks about speed and completeness — their standards never change. You can also ask the AI assistant: “have the concierge push window cleaning this week”.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {AGENTS.map((a) => {
          const mine = r.filter((x) => x.kind === a.kind);
          const okRate = mine.length ? mine.filter((x) => x.ok).length / mine.length : null;
          const lastAt = last.get(a.kind) ?? null;
          const assigned = open.filter((t) => t.agent === a.kind || t.agent === "all");
          const tone = !aiEnabled() ? "red" : okRate === null ? "amber" : okRate < 0.8 ? "red" : "green";
          const label = !aiEnabled() ? "off" : okRate === null ? "no runs in 7 days" : okRate < 0.8 ? `failing ${Math.round((1 - okRate) * 100)}%` : "working";
          return (
            <div key={a.kind} className="card space-y-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div><div className="font-semibold">{a.name}{a.gate ? <span className="ml-2 text-xs text-ink-soft">gatekeeper</span> : null}</div><div className="text-xs text-ink-soft">{a.does}</div></div>
                <Badge tone={tone as "green" | "amber" | "red"}>{label}</Badge>
              </div>
              <div className="text-xs text-ink-soft">Runs: {a.trigger} · {mine.length} in 7 days · last {ago(lastAt)}</div>
              <div className="rounded-xl bg-paper p-3 text-xs"><b>How it drives growth:</b> {a.drives}</div>
              <div className="text-xs"><b>Standing tasks</b><ul className="mt-1 list-disc space-y-0.5 pl-5">{a.tasks.map((t) => <li key={t}>{t}</li>)}</ul></div>
              <div className="text-xs"><b>Assigned</b>{assigned.length ? (
                <ul className="mt-1 space-y-1">{assigned.map((t) => <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-2 py-1"><span>{taskLine(t)} <span className="text-ink-soft">· {t.agent === "all" ? "all agents · " : ""}{t.created_by ?? "staff"}</span></span><TaskActions id={t.id} /></li>)}</ul>
              ) : <span className="text-ink-soft"> — none yet</span>}</div>
            </div>
          );
        })}
      </div>
      {closed.length > 0 && (
        <div className="card text-sm">
          <div className="font-semibold">Recently closed</div>
          <ul className="mt-2 space-y-1 text-xs">{closed.map((t) => <li key={t.id}><Badge tone={t.status === "done" ? "green" : "amber"}>{t.status}</Badge> {AGENTS.find((a) => a.kind === t.agent)?.name ?? t.agent}: {taskLine(t)}{t.note ? <span className="text-ink-soft"> — {t.note}</span> : null}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
