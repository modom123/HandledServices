/*
 * FILE    : apps/web/app/api/cron/sweep/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Vercel cron every 15 min — expire stale offers and re-dispatch, flag jobs at risk, nudge QA backlog.
 */
import { adminClient } from "@/lib/supabase/server";
import { dispatchJob, raiseAlert } from "@/lib/jobs";

export const maxDuration = 300;

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("Unauthorized", { status: 401 });
  const db = adminClient();
  const now = new Date().toISOString();

  // 1. Expired offers → mark expired, re-dispatch jobs that are still unassigned
  const { data: expired } = await db.from("job_offers").update({ status: "expired" }).eq("status", "offered").lt("expires_at", now).select("job_id, contractor_id");
  const jobIds = [...new Set((expired ?? []).map((o: { job_id: string }) => o.job_id))];
  let redispatched = 0;
  for (const jobId of jobIds) {
    const { data: job } = await db.from("jobs").select("id, contractor_id, status").eq("id", jobId).single();
    const { count } = await db.from("job_offers").select("id", { count: "exact", head: true }).eq("job_id", jobId).eq("status", "offered");
    if (job && !job.contractor_id && job.status === "dispatched" && !count) {
      const { data: tried } = await db.from("job_offers").select("contractor_id").eq("job_id", jobId);
      await dispatchJob(jobId, { exclude: (tried ?? []).map((t: { contractor_id: string }) => t.contractor_id) });
      redispatched++;
    }
  }

  // 2. Unassigned jobs within 24h → critical alert (once per job)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const { data: atRisk } = await db.from("jobs").select("id, ref").is("contractor_id", null).in("status", ["scheduled", "dispatched"]).lte("scheduled_date", tomorrow);
  for (const j of atRisk ?? []) {
    const { count } = await db.from("ops_alerts").select("id", { count: "exact", head: true }).eq("job_id", j.id).eq("kind", "unassigned_24h");
    if (!count) await raiseAlert("unassigned_24h", "critical", `${j.ref} has no pro and is due within 24h`, "Call pros directly or reschedule with the customer.", j.id);
  }

  // 3. QA backlog older than 4h
  const fourHoursAgo = new Date(Date.now() - 4 * 3600000).toISOString();
  const { count: qaBacklog } = await db.from("jobs").select("id", { count: "exact", head: true }).eq("status", "qa_review").lt("updated_at", fourHoursAgo);

  return Response.json({ expired: expired?.length ?? 0, redispatched, atRisk: atRisk?.length ?? 0, qaBacklog: qaBacklog ?? 0 });
}
