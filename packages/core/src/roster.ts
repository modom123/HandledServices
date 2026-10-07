/*
 * FILE    : packages/core/src/roster.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_0254 UTC
 * PURPOSE : Where pros are and when they can work — shared by dispatch, the pro app and the Hub.
 *             onCall()        — the pro switched "On call" on (ready for same-day work) until a time
 *             liveLocation()  — last phone location, only while fresh (30 min). Pros share it only
 *                               while on call or on a job today; it's cleared after that.
 *             proStatus()     — On a job / On call / Booked today / Working today / Off today
 *             proCalendar()   — each day ahead: working or off (and why), jobs booked vs daily limit
 *           Times are local to our operating area (OPS_TIME_ZONE).
 * UPDATED : 2026-10-07_1900 UTC — Washington runs on Pacific time: timeZoneForZip / jobTimeZone / proTimeZone / zoneLabel; a pro's "today" uses their own zone.
 */
import type { Contractor, TimeWindow } from "./types.ts";

export const ROSTER_TIME_ZONE = "America/Detroit";
export const PACIFIC_TIME_ZONE = "America/Los_Angeles";

/** Time zone of a ZIP we serve: Washington (980–994) is Pacific; Michigan (and anything else) is Eastern. */
export function timeZoneForZip(zip?: string | null): string {
  const p = zip && /^\d{3}/.test(zip) ? Number(zip.slice(0, 3)) : NaN;
  return p >= 980 && p <= 994 ? PACIFIC_TIME_ZONE : ROSTER_TIME_ZONE;
}
/** A job's local time zone (from its ZIP). */
export const jobTimeZone = (j: { zip?: string | null }) => timeZoneForZip(j.zip);
/** A pro's local time zone (from their place of business). */
export const proTimeZone = (c: { base_zip?: string | null }) => timeZoneForZip(c.base_zip);
/** "ET" / "PT" for messages. */
export const zoneLabel = (timeZone: string) => (timeZone === PACIFIC_TIME_ZONE ? "PT" : "ET");
/** A phone location older than this isn't used or shown as live. */
export const LOCATION_FRESH_MIN = 30;
/** How long "On call" lasts by default, and at most. */
export const ON_CALL_DEFAULT_HOURS = 4;
export const ON_CALL_MAX_HOURS = 14;

/** Local calendar date (YYYY-MM-DD) for an instant. */
export function localDate(d: Date = new Date(), timeZone = ROSTER_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Local hour (0–23) for an instant. */
export function localHour(d: Date = new Date(), timeZone = ROSTER_TIME_ZONE): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(d));
}

export function onCall(c: Pick<Contractor, "on_call_until">, now = new Date()): boolean {
  return Boolean(c.on_call_until) && new Date(c.on_call_until!).getTime() > now.getTime();
}

export function liveLocation(c: Pick<Contractor, "last_lat" | "last_lng" | "last_located_at">, now = new Date()): { lat: number; lng: number; at: string; minutesAgo: number } | null {
  if (c.last_lat == null || c.last_lng == null || !c.last_located_at) return null;
  const mins = (now.getTime() - new Date(c.last_located_at).getTime()) / 60000;
  if (mins > LOCATION_FRESH_MIN || mins < -5) return null;
  return { lat: Number(c.last_lat), lng: Number(c.last_lng), at: c.last_located_at, minutesAgo: Math.max(0, Math.round(mins)) };
}

export type ProStatus = "on_job" | "on_call" | "booked" | "working" | "off";

export const PRO_STATUS_LABEL: Record<ProStatus, string> = {
  on_job: "On a job",
  on_call: "On call",
  booked: "Booked today",
  working: "Working today, open",
  off: "Off today",
};

const WEEKDAY = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

/** Is the pro off on this date? Returns why, or null when they work it. */
export function dayOff(c: Pick<Contractor, "time_off" | "availability">, date: string): string | null {
  if (c.time_off?.includes(date)) return "Day off";
  const days = c.availability?.days;
  const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (days?.length && !days.includes(wd)) return `Doesn't work ${WEEKDAY[wd]}`;
  return null;
}

/** Right now: what is this pro doing? `today` = their jobs scheduled today. */
export function proStatus(c: Contractor, today: { status: string }[], now = new Date()): ProStatus {
  if (today.some((j) => j.status === "in_progress")) return "on_job";
  if (onCall(c, now)) return "on_call";
  const live = today.filter((j) => !["cancelled", "completed"].includes(j.status));
  if (live.length) return "booked";
  return dayOff(c, localDate(now, proTimeZone(c))) ? "off" : "working";
}

export interface CalendarDay {
  date: string;
  weekday: number;
  off: string | null;
  jobs: { id: string; ref?: string; service_slug: string; time_window: TimeWindow; status: string; city?: string | null }[];
  capacity: number;
  open: number;
}

/** The pro's next `days` days: working or off, what's booked and how many slots are open. */
export function proCalendar(
  c: Pick<Contractor, "time_off" | "availability" | "daily_capacity">,
  jobs: { id: string; ref?: string; service_slug: string; scheduled_date: string | null; time_window: TimeWindow; status: string; city?: string | null }[],
  from: string,
  days = 35,
): CalendarDay[] {
  const out: CalendarDay[] = [];
  const start = new Date(`${from}T12:00:00Z`);
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const date = d.toISOString().slice(0, 10);
    const mine = jobs.filter((j) => j.scheduled_date === date && j.status !== "cancelled");
    const off = dayOff(c, date);
    const capacity = Math.max(1, c.daily_capacity);
    out.push({ date, weekday: d.getUTCDay(), off, jobs: mine.map(({ scheduled_date: _s, ...j }) => j), capacity, open: off ? 0 : Math.max(0, capacity - mine.length) });
  }
  return out;
}
