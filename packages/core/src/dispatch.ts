/*
 * FILE    : packages/core/src/dispatch.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-01_2101 UTC — Pro+ and Elite tiers rank higher (first pick of offers).
 * UPDATED : 2026-10-01_2334 UTC — availability (working days, windows, time off), distance from
 *           the pro's base within their radius, and quality from QA pass and redo rates.
 * UPDATED : 2026-10-02_0233 UTC — the daily capacity a pro sets is a hard limit (no offers past it).
 * UPDATED : 2026-10-02_0254 UTC — same-day jobs: pros who are On call can take work even on a day
 *           they don't usually work, rank +15, and are measured from where they are now (fresh
 *           phone location) as well as from base.
 * UPDATED : 2026-10-03_0115 UTC — acceptance rate removed from ranking; on-time weight 18.
 * UPDATED : 2026-10-03_1311 UTC — an approved fast-track pro (tier_floor) skips the probation job-size limit.
 * PURPOSE : Deterministic contractor scoring. Filters to pros who are approved, insured,
 *           qualified for the trade and serve the ZIP, then ranks them. The AI dispatcher
 *           re-ranks this shortlist with job context; if AI is unavailable this ranking
 *           is used as-is, so dispatch never stops.
 */

import { getService } from "./services.ts";
import type { Contractor } from "./types.ts";
import { proTier } from "./pro-program.ts";
import { liveLocation, localDate, onCall } from "./roster.ts";
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
  time_window?: string | null;
  /** Job location (ZIP centroid) for distance; falls back to the pro's ZIP list when missing. */
  lat?: number | null;
  lng?: number | null;
}

/** Per-pro quality stats beyond the rating (from the scorecard). */
export interface QualityStats {
  /** Share of jobs that passed photo QA first time (0–1). */
  qaPass?: number | null;
  /** Redos + refunds per completed job (0–1). */
  redoRate?: number | null;
}

const WEEKDAY = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

/** Straight-line miles between two points. */
export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

/** Distance from the pro's base to the job, when both are known. */
export function proDistance(c: Contractor, job: Pick<DispatchJob, "lat" | "lng">): number | null {
  if (c.base_lat == null || c.base_lng == null || job.lat == null || job.lng == null) return null;
  return milesBetween({ lat: c.base_lat, lng: c.base_lng }, { lat: job.lat, lng: job.lng });
}

/** Same-day job: miles from where the pro is right now (fresh phone location), else null. */
export function liveDistance(c: Contractor, job: Pick<DispatchJob, "lat" | "lng" | "scheduled_date">, now = new Date()): number | null {
  const here = liveLocation(c, now);
  if (!here || job.lat == null || job.lng == null || job.scheduled_date !== localDate(now)) return null;
  return milesBetween(here, { lat: job.lat, lng: job.lng });
}

/** On call for this job: switched on and the job is today. */
export function onCallFor(c: Contractor, job: Pick<DispatchJob, "scheduled_date">, now = new Date()): boolean {
  return onCall(c, now) && job.scheduled_date === localDate(now);
}

/** Does the pro work this date (and window)? Returns the reason they don't, or null. */
export function offDuty(c: Contractor, date: string | null | undefined, window?: string | null): string | null {
  if (!date) return null;
  if (c.time_off?.includes(date)) return "time off";
  const a = c.availability;
  if (!a) return null;
  const day = new Date(`${date}T12:00:00`).getDay();
  if (a.days?.length && !a.days.includes(day)) return `doesn't work ${WEEKDAY[day]}`;
  if (window && window !== "flexible" && a.windows?.length && !a.windows.includes(window)) return `not available ${window}s`;
  return null;
}

export function eligible(c: Contractor, job: DispatchJob, today = new Date()): string | null {
  const svc = getService(job.service_slug);
  if (c.status !== "approved") return "not approved";
  if (svc && !svc.trades.some((t) => c.trades.includes(t))) return "trade mismatch";
  if (svc?.licensed && !c.license_number) return "license required";
  if (svc?.licensed && c.license_expires && new Date(`${c.license_expires}T23:59:59`) < today) return "license expired";
  const base = proDistance(c, job);
  const live = liveDistance(c, job, today);
  const miles = base != null && live != null ? Math.min(base, live) : base ?? live;
  if (miles != null) {
    if (miles > (c.service_radius_mi ?? 25)) return `${Math.round(miles)} mi away (drives ${c.service_radius_mi ?? 25})`;
  } else if (c.service_zips.length && !c.service_zips.includes(job.zip) && !c.service_zips.includes(job.zip.slice(0, 3) + "*"))
    return "outside service area";
  if (!c.insured_until || new Date(c.insured_until) < today) return "insurance expired";
  if (!c.background_checked) return "background check pending";
  if (svc) {
    const missing = requiredCoverages(svc.trades.filter((t) => c.trades.includes(t))).find((k) => !coverageValid(c.coverage, k, today));
    if (missing) return `${missing.replace("_", " ")} coverage missing or expired`;
  }
  if (c.jobs_completed < PROBATION.jobs && !c.tier_floor && Number(job.price_final ?? 0) > PROBATION.maxJobPrice) return "on probation: job too large";
  // switched On call → available today even outside their usual days and hours
  if (onCallFor(c, job, today)) return null;
  return offDuty(c, job.scheduled_date, job.time_window);
}

/**
 * Rank eligible pros (100 points + bonuses). Quality outweighs distance on purpose:
 *   quality 45      rating 25 · first-time QA pass 10 · few redos/refunds 10
 *   reliability 18  on time 10 · accepts offers 8
 *   proximity 12    closer to the job (or exact ZIP match when distance is unknown)
 *   availability 10 open slots that day (a pro at the daily capacity they set gets no offers)
 *   experience 5    jobs completed
 *   + specialist 8, + Pro+/Elite tier boost
 */
export function rankContractors(
  contractors: Contractor[],
  job: DispatchJob,
  loadByContractor: Record<string, number> = {},
  stats: Record<string, QualityStats> = {},
): DispatchCandidate[] {
  return contractors
    .filter((c) => eligible(c, job) === null)
    // the pro sets their own daily capacity — never offer past it
    .filter((c) => !job.scheduled_date || (loadByContractor[c.id] ?? 0) < Math.max(1, c.daily_capacity))
    .map((c) => {
      const load = loadByContractor[c.id] ?? 0;
      const q = stats[c.id] ?? {};
      const reasons: string[] = [];
      let score = 0;
      // quality
      score += (Number(c.rating) / 5) * 25;
      reasons.push(`${Number(c.rating).toFixed(1)}★`);
      const qa = q.qaPass ?? 0.9;
      score += qa * 10;
      if (q.qaPass != null && c.jobs_completed >= 5) reasons.push(`QA ${Math.round(qa * 100)}%`);
      score += (1 - Math.min(1, (q.redoRate ?? 0) * 4)) * 10;
      if ((q.redoRate ?? 0) >= 0.1) reasons.push(`${Math.round((q.redoRate ?? 0) * 100)}% redos`);
      // reliability
      // accepting or declining offers never affects ranking (pros are free to decline)
      score += Number(c.on_time_rate) * 18;
      if (c.on_time_rate < 0.85) reasons.push(`${Math.round(c.on_time_rate * 100)}% on time`);
      // proximity
      const live = liveDistance(c, job);
      const miles = live ?? proDistance(c, job);
      if (onCallFor(c, job)) { score += 15; reasons.push("on call now"); }
      if (live != null) reasons.push("live location");
      if (miles != null) {
        score += 12 * Math.max(0, 1 - miles / Math.max(1, c.service_radius_mi ?? 25));
        reasons.push(`${miles < 1 ? "<1" : Math.round(miles)} mi away`);
      } else score += c.service_zips.includes(job.zip) ? 8 : 5;
      // availability
      const free = Math.max(0, c.daily_capacity - load);
      score += 10 * (free / Math.max(1, c.daily_capacity));
      if (job.scheduled_date) reasons.push(`${free} open slot(s) that day`);
      // experience
      score += (Math.min(c.jobs_completed, 200) / 200) * 5;
      if (c.jobs_completed >= 50) reasons.push(`${c.jobs_completed} jobs done`);
      if (specialtyMatch(c.specialties, job.service_slug)) { score += 8; reasons.push("specialist"); }
      const tier = proTier(c);
      if (tier.dispatchBoost) { score += tier.dispatchBoost; reasons.push(`${tier.name} pro`); }
      return { contractor: c, score: Math.round(score * 10) / 10, reasons, load };
    })
    .sort((a, b) => b.score - a.score);
}
