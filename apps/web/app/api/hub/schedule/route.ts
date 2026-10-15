/*
 * FILE    : apps/web/app/api/hub/schedule/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-12_0005 UTC
 * PURPOSE : Hub → Schedule drag-and-drop (staff). POST JSON { job_id, contractor_id | null, time_window, scheduled_date? }
 *           moves a job to a pro (or back to "Unassigned") and / or another time window or day. Same rules as the job page:
 *           no pro on unpaid work. The new pro gets a push + text with the job; a pro taken off the job is told too.
 *           Customers are not texted automatically — tell them in the job's messages if their window changed.
 * UPDATED : 2026-10-15_0300 UTC — a "pay after" job with its 25% in can be given a pro (clearedForWork).
 */
import { z } from "zod";
import { BRAND, TIME_WINDOW_LABEL, clearedForWork, getService, type TimeWindow } from "@handled/core";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { addEvent } from "@/lib/jobs";
import { notify } from "@/lib/push";
import { siteUrl } from "@/lib/notify";

const Body = z.object({
  job_id: z.string().uuid(),
  contractor_id: z.string().uuid().nullable(),
  time_window: z.enum(["morning", "midday", "afternoon", "flexible"]),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
const LOCKED = ["in_progress", "qa_review", "completed", "cancelled"];

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Invalid move");
  const d = b.data, who = v!.fullName ?? v!.email ?? "staff", db = adminClient();
  const { data: job } = await db.from("jobs").select("id, ref, status, service_slug, contractor_id, time_window, scheduled_date, address, city, paid_at, remedy, billed_on_terms").eq("id", d.job_id).single();
  if (!job) return deny(404, "Job not found");
  if (LOCKED.includes(job.status)) return deny(409, `${job.ref} is ${job.status.replace("_", " ")} — it can't be moved`);
  const proChanged = (job.contractor_id ?? null) !== d.contractor_id;
  const date = d.scheduled_date ?? job.scheduled_date;
  const timeChanged = job.time_window !== d.time_window || date !== job.scheduled_date;
  if (!proChanged && !timeChanged) return Response.json({ ok: true, unchanged: true });
  if (d.contractor_id && proChanged && !clearedForWork(job) && job.status !== "site_visit")
    return deny(409, `Collect payment for ${job.ref} before assigning a pro`);

  const update: Record<string, unknown> = { time_window: d.time_window, scheduled_date: date };
  if (proChanged) {
    update.contractor_id = d.contractor_id;
    if (job.status !== "site_visit") update.status = d.contractor_id ? "assigned" : "dispatched";
  }
  const { error } = await db.from("jobs").update(update).eq("id", job.id);
  if (error) return deny(500, error.message);

  const pros = [d.contractor_id, job.contractor_id].filter(Boolean) as string[];
  const { data: people } = pros.length ? await db.from("contractors").select("id, profile_id, business_name, phone").in("id", pros) : { data: [] };
  const pro = (id: string | null) => (people ?? []).find((p) => p.id === id);
  const name = getService(job.service_slug)?.name ?? job.service_slug;
  const when = `${date ?? "date to be set"} · ${TIME_WINDOW_LABEL[d.time_window as TimeWindow]}`;
  await addEvent(job.id, "human_touch", `Schedule: ${proChanged ? `pro → ${pro(d.contractor_id)?.business_name ?? "unassigned"}` : ""}${proChanged && timeChanged ? ", " : ""}${timeChanged ? `time → ${when}` : ""} (drag and drop)`, who, false);

  const link = `${siteUrl()}/pro/jobs/${job.id}`;
  const now = pro(d.contractor_id);
  if (now) {
    const msg = proChanged ? `${BRAND.name}: you're on ${name} ${job.ref} — ${job.city}, ${when}. ${link}` : `${BRAND.name}: ${job.ref} moved to ${when}. ${link}`;
    await notify(now.profile_id, { title: proChanged ? `New job: ${name} ${job.ref}` : `${job.ref} moved`, body: `${job.city} · ${when}`, data: { type: "job", jobId: job.id }, sms: { to: now.phone, body: msg },
      es: { title: proChanged ? `Nuevo trabajo: ${job.ref}` : `${job.ref} cambió de hora`, body: `${job.city} · ${date ?? ""}`, sms: proChanged ? `${BRAND.name}: tiene ${job.ref} — ${job.city}, ${date ?? ""}. ${link}` : `${BRAND.name}: ${job.ref} cambió a ${date ?? ""}. ${link}` } });
  }
  const before = proChanged ? pro(job.contractor_id) : null;
  if (before) await notify(before.profile_id, { title: `${job.ref} reassigned`, body: "Dispatch moved this job to another pro. Thanks!", data: { type: "job", jobId: job.id }, sms: { to: before.phone, body: `${BRAND.name}: ${job.ref} (${job.city}, ${job.scheduled_date ?? ""}) was moved to another pro — you're off this one. Thanks!` },
    es: { title: `${job.ref} reasignado`, body: "Despacho pasó este trabajo a otro profesional.", sms: `${BRAND.name}: ${job.ref} pasó a otro profesional — ya no lo tiene. ¡Gracias!` } });
  return Response.json({ ok: true, timeChanged });
}
