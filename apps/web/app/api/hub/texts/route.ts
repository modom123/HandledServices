/*
 * FILE    : apps/web/app/api/hub/texts/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-12_0005 UTC
 * PURPOSE : Hub → Texts actions (staff). POST JSON:
 *             { action: "reply", to, body, job_id?, inbox_id? } — text a customer or pro back (threads onto the job)
 *             { action: "handled", id } / { action: "reopen", id } — mark a text dealt with, or bring it back
 *             { action: "link", id, job }                        — attach an unmatched text to a job (ref or id)
 */
import { z } from "zod";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { replyText } from "@/lib/texts";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reply"), to: z.string().trim().min(7).max(20), body: z.string().trim().min(1).max(600), job_id: z.string().uuid().nullable().optional(), inbox_id: z.string().uuid().nullable().optional() }),
  z.object({ action: z.literal("handled"), id: z.string().uuid() }),
  z.object({ action: z.literal("reopen"), id: z.string().uuid() }),
  z.object({ action: z.literal("link"), id: z.string().uuid(), job: z.string().trim().min(3).max(60) }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, b.error.issues[0]?.message ?? "Check the request");
  const d = b.data, who = v!.fullName ?? v!.email ?? "staff", db = adminClient();
  if (d.action === "reply") {
    const r = await replyText({ to: d.to, body: d.body, jobId: d.job_id ?? null, inboxId: d.inbox_id ?? null, staff: who });
    return r.ok ? Response.json({ ok: true }) : deny(502, r.error);
  }
  if (d.action === "handled" || d.action === "reopen") {
    const { error } = await db.from("sms_inbox").update(d.action === "handled" ? { handled_at: new Date().toISOString(), handled_by: who } : { handled_at: null, handled_by: null }).eq("id", d.id);
    return error ? deny(500, error.message) : Response.json({ ok: true });
  }
  const q = /^[0-9a-f-]{36}$/i.test(d.job) ? db.from("jobs").select("id, ref").eq("id", d.job) : db.from("jobs").select("id, ref").eq("ref", d.job.toUpperCase().replace(/^(\d)/, "H-$1"));
  const { data: job } = await q.maybeSingle();
  if (!job) return deny(404, "No job with that ref");
  const { data: t } = await db.from("sms_inbox").update({ job_id: job.id }).eq("id", d.id).select("body, matched_role, profile_id").maybeSingle();
  if (t) await db.from("messages").insert({ job_id: job.id, sender_id: t.profile_id, sender_role: t.matched_role === "pro" ? "pro" : t.matched_role === "customer" ? "customer" : "ops", body: `📱 ${t.matched_role === "unknown" ? "(text from an unknown number) " : ""}${t.body}`.slice(0, 2000) });
  return Response.json({ ok: true, ref: job.ref });
}
