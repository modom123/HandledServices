/*
 * FILE    : apps/web/lib/metrics.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_1800 UTC
 * PURPOSE : The north-star operating metric: AI-driven rate — the share of completed
 *           jobs that went from booking to paid with zero human touches. Target ≥ 80%.
 *           A "human touch" is any job event logged with kind human_touch or
 *           status_manual by a staff member (IEBC AI employees don't count as human).
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const HUMAN_KINDS = ["human_touch", "status_manual"];
export const AI_DRIVEN_TARGET = 0.8;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function aiDrivenRate(db: SupabaseClient<any, any, any>, sinceIso: string) {
  const { data: done } = await db.from("jobs").select("id").eq("status", "completed").gte("completed_at", sinceIso).limit(5000);
  const ids = (done ?? []).map((j: { id: string }) => j.id);
  if (!ids.length) return { completed: 0, untouched: 0, rate: null as number | null };
  const touched = new Set<string>();
  for (let i = 0; i < ids.length; i += 500) {
    const { data: ev } = await db.from("job_events").select("job_id, actor").in("job_id", ids.slice(i, i + 500)).in("kind", HUMAN_KINDS);
    for (const e of ev ?? []) if (!String(e.actor).startsWith("IEBC")) touched.add(e.job_id);
  }
  return { completed: ids.length, untouched: ids.length - touched.size, rate: (ids.length - touched.size) / ids.length };
}
