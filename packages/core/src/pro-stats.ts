/*
 * FILE    : packages/core/src/pro-stats.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_0233 UTC
 * UPDATED : 2026-10-03_0115 UTC — acceptance rate is informational only (not used for tiers, ranking or pay);
 *           expired offers no longer count.
 * PURPOSE : The numbers behind tiers and dispatch, from what really happened:
 *             acceptanceRate() — offers accepted ÷ offers the pro could answer (last 90 days).
 *                                Offers another pro took first ("taken") don't count against anyone.
 *             onTimeRate()     — jobs started before the end of the booked time window (local time).
 *             referralDue()    — the refer-a-pro bonus is owed once the new pro finishes N jobs.
 *           Too little history → the rate stays where it is (new pros aren't punished by one miss).
 * UPDATED : 2026-10-07_1900 UTC — on-time checks use the job's own time zone.
 */
import { timeZoneForZip } from "./roster.ts";
import { PRO_REFERRAL } from "./pro-program.ts";
import type { TimeWindow } from "./types.ts";

export const STATS_WINDOW_DAYS = 90;
export const MIN_OFFERS_FOR_RATE = 5;
export const MIN_JOBS_FOR_RATE = 3;
/** Local hour each booked window ends (start before this = on time). */
export const WINDOW_END_HOUR: Record<TimeWindow, number> = { morning: 11, midday: 14, afternoon: 17, flexible: 20 };
export const OPS_TIME_ZONE = "America/Detroit";

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function acceptanceRate(offers: { status: string }[], current: number): number {
  // shown to the pro for their own information only; ignored (expired) offers never count
  const counted = offers.filter((o) => ["accepted", "declined"].includes(o.status));
  if (counted.length < MIN_OFFERS_FOR_RATE) return current;
  return r3(counted.filter((o) => o.status === "accepted").length / counted.length);
}

/** Local date (YYYY-MM-DD) and hour of an instant in our operating time zone. */
export function localParts(iso: string, timeZone = OPS_TIME_ZONE): { date: string; hour: number } {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

export function startedOnTime(j: { scheduled_date: string | null; time_window: TimeWindow; started_at: string | null; zip?: string | null }): boolean | null {
  if (!j.scheduled_date || !j.started_at) return null;
  const { date, hour } = localParts(j.started_at, j.zip ? timeZoneForZip(j.zip) : OPS_TIME_ZONE);
  if (date !== j.scheduled_date) return date < j.scheduled_date;
  return hour < WINDOW_END_HOUR[j.time_window];
}

export function onTimeRate(jobs: { scheduled_date: string | null; time_window: TimeWindow; started_at: string | null }[], current: number): number {
  const checked = jobs.map(startedOnTime).filter((x): x is boolean => x !== null);
  if (checked.length < MIN_JOBS_FOR_RATE) return current;
  return r3(checked.filter(Boolean).length / checked.length);
}

export function referralDue(referred: { referred_by: string | null; jobs_completed: number; referral_bonus_paid_at?: string | null; status: string }): boolean {
  return Boolean(referred.referred_by) && !referred.referral_bonus_paid_at && referred.status === "approved" && referred.jobs_completed >= PRO_REFERRAL.afterJobs;
}
