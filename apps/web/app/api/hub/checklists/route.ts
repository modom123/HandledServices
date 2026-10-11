/*
 * FILE    : apps/web/app/api/hub/checklists/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-11_2250 UTC
 * PURPOSE : Hub → Checklists actions (staff). POST JSON:
 *             { action: "save", id?, name, service_slug?, draft }   — create or update a saved checklist
 *             { action: "delete", id }                              — remove a saved checklist (jobs keep their copy)
 *             { action: "attach", job, source }                     — put a checklist on a job (job = ref "H-1234" or id)
 *             { action: "email", contractor_id, source, job? }      — email a checklist to a pro (source "job" = the job's own)
 *           source: "t:<service slug>" (built-in) or "s:<saved id>".
 */
import { z } from "zod";
import { checklistFromDraft, getService } from "@handled/core";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { attachChecklist, emailChecklist } from "@/lib/checklists";

const source = z.string().regex(/^(t:[a-z0-9-]{2,60}|s:[0-9a-f-]{36}|job)$/i);
const draft = z.object({
  title: z.string().max(120), title_es: z.string().max(120).nullable().optional(),
  sections: z.array(z.object({ title: z.string().max(80), title_es: z.string().max(80).nullable().optional(),
    items: z.array(z.object({ text: z.string().max(300), text_es: z.string().max(300).nullable().optional(), required: z.boolean().optional(), photo: z.boolean().optional() })).max(60) })).max(20),
});
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), id: z.string().uuid().optional(), name: z.string().trim().min(2).max(120), service_slug: z.string().max(60).nullable().optional(), draft }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }),
  z.object({ action: z.literal("attach"), job: z.string().trim().min(3).max(60), source }),
  z.object({ action: z.literal("email"), contractor_id: z.string().uuid(), source, job: z.string().trim().max(60).nullable().optional() }),
]);

/** A job by ref ("H-1234", any case) or id. */
async function findJob(ref: string): Promise<string | null> {
  const db = adminClient();
  const q = /^[0-9a-f-]{36}$/i.test(ref) ? db.from("jobs").select("id").eq("id", ref) : db.from("jobs").select("id").eq("ref", ref.toUpperCase().replace(/^(\d)/, "H-$1"));
  const { data } = await q.maybeSingle();
  return data?.id ?? null;
}

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, b.error.issues[0]?.message ?? "Check the request");
  const d = b.data, who = v!.fullName ?? v!.email, db = adminClient();

  if (d.action === "save") {
    const slug = d.service_slug && getService(d.service_slug) ? d.service_slug : null;
    const checklist = checklistFromDraft(d.draft, slug ?? "custom");
    if (!checklist) return deny(400, "Add at least one item");
    const row = { name: d.name, service_slug: slug, checklist, updated_by: who, updated_at: new Date().toISOString() };
    const res = d.id ? await db.from("saved_checklists").update(row).eq("id", d.id).select("id").maybeSingle() : await db.from("saved_checklists").insert({ ...row, created_by: who }).select("id").maybeSingle();
    if (res.error) return deny(500, /saved_checklists/.test(res.error.message) ? "Run supabase/setup/RUN_ONCE_LATEST_2026-10-11_2250.sql in Supabase first" : res.error.message);
    return Response.json({ ok: true, id: res.data?.id });
  }
  if (d.action === "delete") {
    const { error } = await db.from("saved_checklists").delete().eq("id", d.id);
    return error ? deny(500, error.message) : Response.json({ ok: true });
  }
  if (d.action === "attach") {
    const jobId = await findJob(d.job);
    if (!jobId) return deny(404, `No job ${d.job}`);
    if (d.source === "job") return deny(400, "Pick a checklist");
    const r = await attachChecklist(jobId, d.source, who);
    return r.ok ? Response.json({ ...r, jobId }) : deny(409, r.error ?? "Couldn't attach");
  }
  const jobId = d.job ? await findJob(d.job) : null;
  if (d.job && !jobId) return deny(404, `No job ${d.job}`);
  if (d.source === "job" && !jobId) return deny(400, "Give the job to send its checklist");
  const r = await emailChecklist(d.contractor_id, d.source, jobId, who);
  return r.ok ? Response.json(r) : deny(502, r.error ?? "Couldn't send");
}
