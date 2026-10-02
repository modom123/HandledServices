/*
 * FILE    : apps/web/app/api/account/jobs/[id]/photos/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_0201 UTC
 * UPDATED : 2026-10-02_1412 UTC — Spanish versions of person-facing texts, emails and push.
 * PURPOSE : Customer adds photos to a booking after booking (web or app): more angles, a
 *           close-up, the thing the pro should know about. Uploaded first via /api/uploads;
 *           this attaches them (up to 12) and lets the pro know.
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { addEvent, getJob } from "@/lib/jobs";
import { notify } from "@/lib/push";

const MAX = 12;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in first");
  const { id } = await ctx.params;
  const { data: mine } = await v.db.from("jobs").select("id").eq("id", id).maybeSingle(); // RLS: own jobs only
  if (!mine) return deny(404, "Not found");
  const b = z.object({ paths: z.array(z.string().regex(/^(booking|pro)\/[\w./-]+$/)).min(1).max(MAX) }).safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Upload the photos first");
  const job = await getJob(id);
  if (!job || ["completed", "cancelled"].includes(job.status)) return deny(409, "This booking is closed");
  const photos = [...new Set([...(job.photos ?? []), ...b.data.paths])].slice(0, MAX);
  const added = photos.length - (job.photos ?? []).length;
  if (!added) return deny(409, `Up to ${MAX} photos per booking`);
  await adminClient().from("jobs").update({ photos }).eq("id", id);
  await addEvent(id, "photos", `You added ${added} photo${added > 1 ? "s" : ""}.`, "customer", true, `Agregó ${added} foto${added > 1 ? "s" : ""}.`);
  if (job.contractor_id) {
    const { data: pro } = await adminClient().from("contractors").select("profile_id").eq("id", job.contractor_id).single();
    await notify(pro?.profile_id, { title: `New photos · ${job.ref}`, body: `The customer added ${added} photo${added > 1 ? "s" : ""}.`, data: { type: "job_pro", jobId: id },
      es: { title: `Fotos nuevas · ${job.ref}`, body: `El cliente agregó ${added} foto${added > 1 ? "s" : ""}.` } });
  }
  return Response.json({ ok: true, count: photos.length });
}
