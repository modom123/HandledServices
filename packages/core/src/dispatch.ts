/*
 * FILE    : packages/core/src/dispatch.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Deterministic contractor scoring. Filters to pros who are approved, insured,
 *           qualified for the trade and serve the ZIP, then ranks them. The AI dispatcher
 *           re-ranks this shortlist with job context; if AI is unavailable this ranking
 *           is used as-is, so dispatch never stops.
 */

import { getService } from "./services.ts";
import type { Contractor } from "./types.ts";

export interface DispatchCandidate {
  contractor: Contractor;
  score: number;
  reasons: string[];
  /** Jobs already on this pro's calendar for the job date. */
  load: number;
}

export interface DispatchJob {
  service_slug: string;
  zip: string;
  scheduled_date: string | null;
}

export function eligible(c: Contractor, job: DispatchJob, today = new Date()): string | null {
  const svc = getService(job.service_slug);
  if (c.status !== "approved") return "not approved";
  if (svc && !svc.trades.some((t) => c.trades.includes(t))) return "trade mismatch";
  if (svc?.licensed && !c.license_number) return "license required";
  if (c.service_zips.length && !c.service_zips.includes(job.zip) && !c.service_zips.includes(job.zip.slice(0, 3) + "*"))
    return "outside service area";
  if (!c.insured_until || new Date(c.insured_until) < today) return "insurance expired";
  if (!c.background_checked) return "background check pending";
  return null;
}

export function rankContractors(
  contractors: Contractor[],
  job: DispatchJob,
  loadByContractor: Record<string, number> = {},
): DispatchCandidate[] {
  return contractors
    .filter((c) => eligible(c, job) === null)
    .map((c) => {
      const load = loadByContractor[c.id] ?? 0;
      const reasons: string[] = [];
      let score = 0;
      score += (c.rating / 5) * 40;
      reasons.push(`${c.rating.toFixed(1)}★ rating`);
      score += c.on_time_rate * 20;
      score += c.acceptance_rate * 15;
      score += Math.min(c.jobs_completed, 200) / 200 * 15;
      if (c.jobs_completed >= 50) reasons.push(`${c.jobs_completed} jobs done`);
      const free = Math.max(0, c.daily_capacity - load);
      score += free > 0 ? 10 : -50;
      reasons.push(free > 0 ? `${free} open slot(s) that day` : "fully booked that day");
      return { contractor: c, score: Math.round(score * 10) / 10, reasons, load };
    })
    .sort((a, b) => b.score - a.score);
}
