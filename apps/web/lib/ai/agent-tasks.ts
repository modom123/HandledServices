/*
 * FILE    : apps/web/lib/ai/agent-tasks.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-06_0752 UTC
 * PURPOSE : Tasks the team assigns to AI agents (agent_tasks) and the mission preface every agent runs with.
 *           systemFor(kind, own) = missionPrompt (goal, focus, standing + assigned tasks, guardrails) + the agent's own
 *           instructions. Open tasks are cached for a minute so a busy chat doesn't hit the database every turn;
 *           a database problem never blocks an agent (it just runs without assigned tasks).
 */
import "server-only";
import { missionPrompt } from "@handled/core";
import { adminClient } from "../supabase/server";

export interface AgentTask { id: string; agent: string; title: string; target: string | null; due_date: string | null; status: "open" | "done" | "cancelled"; note: string | null; created_by: string | null; created_at: string; closed_at: string | null }

let cache: { at: number; rows: AgentTask[] } | null = null;

export async function openAgentTasks(fresh = false): Promise<AgentTask[]> {
  if (!fresh && cache && Date.now() - cache.at < 60_000) return cache.rows;
  try {
    const { data, error } = await adminClient().from("agent_tasks").select("*").eq("status", "open").order("due_date", { ascending: true, nullsFirst: false }).limit(200);
    if (error) return cache?.rows ?? [];
    cache = { at: Date.now(), rows: (data ?? []) as AgentTask[] };
    return cache.rows;
  } catch {
    return cache?.rows ?? [];
  }
}

export const taskLine = (t: Pick<AgentTask, "title" | "target" | "due_date">) => `${t.title}${t.target ? ` (target: ${t.target})` : ""}${t.due_date ? ` (due ${t.due_date})` : ""}`;

/** The full system prompt for an agent: the shared mission and its tasks, then its own instructions. */
export async function systemFor(kind: string, own: string): Promise<string> {
  const tasks = (await openAgentTasks()).filter((t) => t.agent === kind || t.agent === "all").map(taskLine);
  return `${missionPrompt(kind, tasks)}\n\n${own}`;
}

export async function assignTask(t: { agent: string; title: string; target?: string | null; due_date?: string | null; note?: string | null }, actor: string) {
  const { data, error } = await adminClient().from("agent_tasks").insert({ agent: t.agent, title: t.title, target: t.target ?? null, due_date: t.due_date ?? null, note: t.note ?? null, created_by: actor }).select("*").single();
  cache = null;
  if (error) throw new Error(error.message);
  return data as AgentTask;
}

export async function closeTask(id: string, status: "done" | "cancelled" | "open", note: string | null, actor: string) {
  const patch: Record<string, unknown> = { status, closed_at: status === "open" ? null : new Date().toISOString() };
  if (note) patch.note = `${note} — ${actor}`;
  const { error } = await adminClient().from("agent_tasks").update(patch).eq("id", id);
  cache = null;
  if (error) throw new Error(error.message);
}
