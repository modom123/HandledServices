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
 * UPDATED : 2026-10-11_2250 UTC — chosen checklists (Hub → Checklists and the job page):
 *             checklistFromSource — "t:<service>" (built-in template, using the job's answers) or "s:<id>" (saved)
 *             attachChecklist     — put a chosen checklist on a job (replaces the frozen one; checks already made
 *                                   on items that still exist are kept)
 *             emailChecklist      — email a checklist to a pro (in their language), optionally for a job
 */
import "server-only";
import { BRAND, CATEGORIES, SERVICES, buildChecklist, checklistProgress, checklistText, getService, resolveChecklist, type ChecklistCheck, type ChecklistExtra, type Job, type JobChecklist } from "@handled/core";
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

// ─── Chosen checklists (Hub → Checklists, job page) ─────────────────────────

/** A checklist by source: "t:<service slug>" = built-in template (answers pick its items), "s:<uuid>" = saved in Hub. */
export async function checklistFromSource(source: string, answers: Record<string, unknown> = {}): Promise<{ checklist: JobChecklist; name: string } | null> {
  if (source.startsWith("t:")) {
    const slug = source.slice(2);
    if (!getService(slug)) return null;
    const c = buildChecklist(slug, answers);
    return { checklist: c, name: c.title };
  }
  if (source.startsWith("s:")) {
    const id = source.slice(2);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const { data } = await db().from("saved_checklists").select("name, checklist").eq("id", id).maybeSingle();
    return data ? { checklist: data.checklist as JobChecklist, name: String(data.name) } : null;
  }
  return null;
}

/** Put a chosen checklist on a job. Not on finished jobs. Checks on items that still exist carry over. */
export async function attachChecklist(jobId: string, source: string, actor: string): Promise<{ ok: boolean; error?: string; name?: string; kept?: number }> {
  const { data: job } = await db().from("jobs").select("id, ref, status, answers, contractor_id").eq("id", jobId).maybeSingle();
  if (!job) return { ok: false, error: "Job not found" };
  if (["completed", "cancelled", "qa_review"].includes(job.status)) return { ok: false, error: "This job is finished — its checklist can't change" };
  const picked = await checklistFromSource(source, (job.answers ?? {}) as Record<string, unknown>);
  if (!picked) return { ok: false, error: "Checklist not found" };
  const { error } = await db().from("jobs").update({ checklist: picked.checklist }).eq("id", jobId);
  if (error) return { ok: false, error: error.message };
  const ids = picked.checklist.sections.flatMap((s) => s.items.map((i) => i.id));
  const { count } = await db().from("job_checklist_checks").select("item_id", { count: "exact", head: true }).eq("job_id", jobId).in("item_id", ids.length ? ids : ["-"]);
  await db().from("job_events").insert({ job_id: jobId, kind: "human_touch", message: `Checklist set to "${picked.name}"`, actor, visible_to_customer: false });
  return { ok: true, name: picked.name, kept: count ?? 0 };
}

/** Email a checklist to a pro (their language), with the job's ref and special instructions when a job is given. */
export async function emailChecklist(contractorId: string, source: string, jobId: string | null, actor: string): Promise<{ ok: boolean; error?: string; to?: string }> {
  const { data: pro } = await db().from("contractors").select("id, email, contact_name, business_name, profile_id").eq("id", contractorId).maybeSingle();
  if (!pro?.email) return { ok: false, error: "Pro not found" };
  const { data: job } = jobId ? await db().from("jobs").select("*").eq("id", jobId).maybeSingle() : { data: null };
  const picked = source === "job" && job ? { checklist: resolveChecklist(job as Job), name: "this job's checklist" } : await checklistFromSource(source, ((job?.answers ?? {}) as Record<string, unknown>));
  if (!picked) return { ok: false, error: "Checklist not found" };
  const { localeOf } = await import("./push");
  const es = (await localeOf(pro.profile_id, null)) === "es";
  const first = String(pro.contact_name ?? pro.business_name).split(" ")[0];
  const jobLine = job ? (es ? `Trabajo ${job.ref} · ${job.scheduled_date ?? "fecha por confirmar"}\n\n` : `Job ${job.ref} · ${job.scheduled_date ?? "date to be confirmed"}\n\n`) : "";
  const subject = es ? `Lista de trabajo${job ? ` para ${job.ref}` : ""}: ${picked.checklist.title_es}` : `Job checklist${job ? ` for ${job.ref}` : ""}: ${picked.checklist.title}`;
  const text = `${es ? `Hola ${first}:` : `Hi ${first},`}\n\n${es ? "Esta es la lista de trabajo. Describe el resultado; usted elige sus métodos y herramientas." : "Here's the job checklist. It describes the result — you choose your own methods and tools."}\n\n${jobLine}${checklistText(picked.checklist, es ? "es" : "en")}\n\n${es ? "En la app marcará cada punto como hecho (o N/A con el motivo) y subirá las fotos." : "In the app you'll check each item off (or mark it N/A with a reason) and add the photos."}\n\n— ${BRAND.name}`;
  const { sendEmail } = await import("./notify");
  const ok = await sendEmail(pro.email, subject, text);
  if (job) await db().from("job_events").insert({ job_id: job.id, kind: "human_touch", message: `Checklist emailed to ${pro.business_name}`, actor, visible_to_customer: false });
  return ok ? { ok: true, to: pro.email } : { ok: false, error: "The email couldn't be sent — check the email setup (Hub → Go-live setup)" };
}

/** The checklist dropdown: saved checklists first, then the built-in ones by category. */
export async function checklistOptions(): Promise<{ options: { group: string; items: { value: string; label: string }[] }[]; saved: { id: string; name: string; service_slug: string | null; updated_at: string; updated_by: string | null; checklist: JobChecklist }[]; savedReady: boolean }> {
  const res = await db().from("saved_checklists").select("id, name, service_slug, updated_at, updated_by, checklist").order("name").limit(300);
  const saved = (res.error ? [] : res.data ?? []) as { id: string; name: string; service_slug: string | null; updated_at: string; updated_by: string | null; checklist: JobChecklist }[];
  const options = [
    ...(saved.length ? [{ group: "Saved checklists", items: saved.map((x) => ({ value: `s:${x.id}`, label: `${x.name}${x.service_slug ? ` · ${getService(x.service_slug)?.name ?? x.service_slug}` : ""}` })) }] : []),
    ...CATEGORIES.map((c) => ({ group: `Built-in · ${c.name}`, items: SERVICES.filter((x) => x.category === c.id).map((x) => ({ value: `t:${x.slug}`, label: `${x.icon} ${x.name}` })) })).filter((g) => g.items.length),
  ];
  return { options, saved, savedReady: !res.error };
}
