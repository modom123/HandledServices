/*
 * FILE    : apps/web/app/api/hub/coverage/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-06_2120 UTC
 * PURPOSE : Hub → Cancellations & coverage actions (staff):
 *             { action: "call_backup", job_id }        — call the next backup now
 *             { action: "offer_all", job_id }          — skip the backups, offer to every nearby pro
 *             { action: "line_up", job_id }            — ask more pros to stand by
 *             { action: "excuse", event_id, note }     — an emergency: the late / short-notice cancel no longer counts
 */
import { z } from "zod";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { addEvent, dispatchJob } from "@/lib/jobs";
import { callNextBackup, lineUpBackups } from "@/lib/coverage";
import { excuseCancel } from "@/lib/standing";
import { adminClient } from "@/lib/supabase/server";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("call_backup"), job_id: z.string().uuid() }),
  z.object({ action: z.literal("offer_all"), job_id: z.string().uuid() }),
  z.object({ action: z.literal("line_up"), job_id: z.string().uuid() }),
  z.object({ action: z.literal("excuse"), event_id: z.string().uuid(), note: z.string().trim().min(3).max(300) }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check the request");
  const d = b.data, who = v!.fullName ?? v!.email;
  if (d.action === "excuse") { const r = await excuseCancel(d.event_id, who, d.note); return r.ok ? Response.json(r) : deny(409, "Already excused or not a cancellation"); }
  if (d.action === "line_up") return Response.json({ ok: true, asked: await lineUpBackups(d.job_id) });
  const { data: job } = await adminClient().from("jobs").select("id, contractor_id").eq("id", d.job_id).maybeSingle();
  if (!job) return deny(404, "Job not found");
  if (job.contractor_id) return deny(409, "A pro already has this job");
  if (d.action === "call_backup") { const r = await callNextBackup(d.job_id); await addEvent(d.job_id, "human_touch", `Backup call sent by ${who}`, who, false); return Response.json({ ok: true, ...r }); }
  const { data: tried } = await adminClient().from("job_offers").select("contractor_id").eq("job_id", d.job_id).in("status", ["declined", "expired", "taken"]);
  await addEvent(d.job_id, "human_touch", `Offered to all nearby pros by ${who}`, who, false);
  return Response.json({ ok: true, ...(await dispatchJob(d.job_id, { exclude: ((tried ?? []) as { contractor_id: string }[]).map((t) => t.contractor_id) })) });
}
