/*
 * FILE    : apps/web/lib/ai/dispatch.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : AI dispatcher. Takes the deterministic shortlist (eligible, insured, in
 *           area) and re-ranks it using job context — customer notes, past ratings,
 *           crew size for big jobs, commercial experience. It can only choose from
 *           the shortlist; unknown IDs are dropped.
 */
import "server-only";
import { z } from "zod";
import type { DispatchCandidate, Job } from "@handled/core";
import { getService } from "@handled/core";
import { structured } from "./client";

const DispatchSchema = z.object({
  ranking: z.array(z.object({ contractor_id: z.string(), score: z.number().min(0).max(100), reason: z.string() })),
  offer_count: z.number().int().min(1).max(3).describe("How many pros to offer the job to at once"),
  dispatcher_note: z.string(),
});
export type AiDispatch = z.infer<typeof DispatchSchema>;

export async function aiRankCandidates(job: Job, shortlist: DispatchCandidate[]): Promise<AiDispatch | null> {
  if (shortlist.length < 2) return null; // nothing to choose between
  const svc = getService(job.service_slug);
  const pros = shortlist.slice(0, 8).map((c) => ({
    contractor_id: c.contractor.id,
    business: c.contractor.business_name,
    trades: c.contractor.trades,
    rating: c.contractor.rating,
    jobs_completed: c.contractor.jobs_completed,
    acceptance_rate: c.contractor.acceptance_rate,
    on_time_rate: c.contractor.on_time_rate,
    jobs_already_that_day: c.load,
    daily_capacity: c.contractor.daily_capacity,
    notes: c.contractor.notes,
    baseline_score: c.score,
  }));
  const out = await structured({
    kind: "dispatch",
    jobId: job.id,
    schema: DispatchSchema,
    system:
      "You are the dispatcher for a home-services company that subcontracts every job. Rank the eligible pros for this job. " +
      "Weigh quality (rating, on-time) above speed, avoid overloading a pro, prefer commercial experience for business customers, " +
      "and offer to more pros at once (2-3) when the job is urgent or same-week. Only use contractor_ids from the list.",
    content: JSON.stringify({
      job: {
        service: svc?.name,
        customer_type: job.customer_type,
        date: job.scheduled_date,
        window: job.time_window,
        priority: job.priority,
        zip: job.zip,
        answers: job.answers,
        notes: job.notes,
        estimate: [job.estimate_low, job.estimate_high],
      },
      eligible_pros: pros,
    }),
    effort: "low",
  });
  if (!out) return null;
  const valid = new Set(pros.map((p) => p.contractor_id));
  return { ...out, ranking: out.ranking.filter((r) => valid.has(r.contractor_id)) };
}
