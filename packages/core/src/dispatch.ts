/*
 * FILE    : packages/core/src/dispatch.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-01_2101 UTC — Pro+ and Elite tiers rank higher (first pick of offers).
 * PURPOSE : Deterministic contractor scoring. Filters to pros who are approved, insured,
 *           qualified for the trade and serve the ZIP, then ranks them. The AI dispatcher
 *           re-ranks this shortlist with job context; if AI is unavailable this ranking
 *           is used as-is, so dispatch never stops.
 */

import { getService } from "./services.ts";
import type { Contractor } from "./types.ts";
import { proTier } from "./pro-program.ts";
import { PROBATION, coverageValid, requiredCoverages, specialtyMatch } from "./vetting.ts";

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
  /** Job price; caps the size of jobs offered to pros still on probation. */
  price_final?: number | null;
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
  if (svc) {
    const missing = requiredCoverages(svc.trades.filter((t) => c.trades.includes(t))).find((k) => !coverageValid(c.coverage, k, today));
    if (missing) return `${missing.replace("_", " ")} coverage missing or expired`;
  }
  if (c.jobs_completed < PROBATION.jobs && Number(job.price_final ?? 0) > PROBATION.maxJobPrice) return "on probation: job too large";
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
      if (specialtyMatch(c.specialties, job.service_slug)) { score += 8; reasons.push("specialist"); }
      const tier = proTier(c);
      if (tier.dispatchBoost) { score += tier.dispatchBoost; reasons.push(`${tier.name} pro`); }
      const free = Math.max(0, c.daily_capacity - load);
      score += free > 0 ? 10 : -50;
      reasons.push(free > 0 ? `${free} open slot(s) that day` : "fully booked that day");
      return { contractor: c, score: Math.round(score * 10) / 10, reasons, load };
    })
    .sort((a, b) => b.score - a.score);
}
