/*
 * FILE    : apps/web/lib/checklists.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_0221 UTC
 * PURPOSE : Job checklists on the server (format and templates in packages/core/src/checklists.ts).
 *             freezeChecklist  — when a pro takes the job, its checklist is saved on the job so the text
 *                                can't change mid-job (also done lazily on first use)
 *             checklistState   — the job's checklist, what's checked, and progress (pro, customer, Hub, QA)
 *             checkItem        — the pro on the job marks an item done, N/A (with a reason) or undoes it
 *             addSpecial / removeSpecial — special instructions for one job: staff any time before it's
 *                                done; the customer before work starts (a request, not extra paid scope)
 *             openRequired     — required items still open (completion is blocked until they're handled)
 */
import "server-only";
import { buildChecklist, checklistProgress, resolveChecklist, type ChecklistCheck, type ChecklistExtra, type Job } from "@handled/core";
import { adminClient } from "./supabase/server";

const db = () => adminClient();
const MAX_EXTRA = 15, MAX_CUSTOMER = 5;

/** Save the checklist on the job (template part only; special instructions stay live). */
export async function freezeChecklist(job: Pick<Job, "id" | "service_slug" | "answers" | "checklist">) {
  if (job.checklist) return job.checklist;
  const c = buildChecklist(job.service_slug, (job.answers ?? {}) as Record<string, unknown>);
  await db().from("jobs").update({ checklist: c }).eq("id", job.id).is("checklist", null);
  return c;
}

export async function checklistState(job: Job) {
  const { data } = await db().from("job_checklist_checks").select("item_id, status, note, checked_by, checked_at").eq("job_id", job.id);
  const checks = (data ?? []) as (ChecklistCheck & { checked_by: string | null })[];
  const checklist = resolveChecklist(job);
  return { checklist, checks, progress: checklistProgress(checklist, checks) };
}

/** Required items not yet done or N/A — the job can't be submitted while any remain. */
export async function openRequired(job: Job) {
  if (!job.checklist && job.contractor_id) job.checklist = await freezeChecklist(job);
  return (await checklistState(job)).progress.open;
}

export async function checkItem(jobId: string, contractorId: string, itemId: string, status: "done" | "na" | "undo", note: string | null, actor: string): Promise<{ ok: boolean; error?: string }> {
  const { data } = await db().from("jobs").select("*").eq("id", jobId).maybeSingle();
  const job = data as Job | null;
  if (!job || job.contractor_id !== contractorId) return { ok: false, error: "Not your job" };
  if (!["assigned", "in_progress"].includes(job.status)) return { ok: false, error: "The checklist is locked once the job is submitted" };
  if (!job.checklist) job.checklist = await freezeChecklist(job);
  const item = resolveChecklist(job).sections.flatMap((s) => s.items).find((x) => x.id === itemId);
  if (!item) return { ok: false, error: "That item isn't on this job's checklist" };
  if (status === "undo") {
    await db().from("job_checklist_checks").delete().eq("job_id", jobId).eq("item_id", itemId);
    return { ok: true };
  }
  if (status === "na" && (note ?? "").trim().length < 3) return { ok: false, error: "Say why it doesn't apply" };
  const { error } = await db().from("job_checklist_checks").upsert({ job_id: jobId, item_id: itemId, status, note: status === "na" ? note!.trim().slice(0, 500) : note?.trim().slice(0, 500) || null, checked_by: actor, checked_at: new Date().toISOString() }, { onConflict: "job_id,item_id" });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** A special instruction on one job. Customers: before the work starts, up to 5, never required. */
export async function addSpecial(jobId: string, text: string, from: "staff" | "customer", required: boolean, actor: string): Promise<{ ok: boolean; error?: string }> {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 300);
  if (clean.length < 3) return { ok: false, error: "Write the instruction" };
  const { data } = await db().from("jobs").select("id, status, checklist_extra").eq("id", jobId).maybeSingle();
  if (!data) return { ok: false, error: "Job not found" };
  const extra = (data.checklist_extra ?? []) as ChecklistExtra[];
  if (["completed", "cancelled", "qa_review"].includes(data.status)) return { ok: false, error: "This job is already finished" };
  if (from === "customer" && ["in_progress"].includes(data.status)) return { ok: false, error: "The pro has started — message them in the chat instead" };
  if (from === "customer" && extra.filter((x) => x.from === "customer").length >= MAX_CUSTOMER) return { ok: false, error: `Up to ${MAX_CUSTOMER} requests per job` };
  if (extra.length >= MAX_EXTRA) return { ok: false, error: "Too many special instructions on this job" };
  const item: ChecklistExtra = { id: `x${Date.now().toString(36)}`, text: clean, required: from === "staff" ? required : false, from, at: new Date().toISOString() };
  await db().from("jobs").update({ checklist_extra: [...extra, item] }).eq("id", jobId);
  await db().from("job_events").insert({ job_id: jobId, kind: "checklist", message: `${from === "staff" ? "Special instruction" : "Customer request"} added: ${clean}`, actor, visible_to_customer: from === "customer" });
  return { ok: true };
}

export async function removeSpecial(jobId: string, id: string, by: "staff" | "customer"): Promise<{ ok: boolean; error?: string }> {
  const { data } = await db().from("jobs").select("status, checklist_extra").eq("id", jobId).maybeSingle();
  if (!data) return { ok: false, error: "Job not found" };
  const extra = (data.checklist_extra ?? []) as ChecklistExtra[];
  const target = extra.find((x) => x.id === id);
  if (!target) return { ok: false, error: "Not found" };
  if (by === "customer" && (target.from !== "customer" || data.status === "in_progress")) return { ok: false, error: "You can only remove your own requests before the work starts" };
  await db().from("jobs").update({ checklist_extra: extra.filter((x) => x.id !== id) }).eq("id", jobId);
  await db().from("job_checklist_checks").delete().eq("job_id", jobId).eq("item_id", `special.${id}`);
  return { ok: true };
}
