/*
 * FILE    : packages/core/src/availability.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2115 UTC
 * PURPOSE : Booking-calendar availability. For each day and arrival window, how many more
 *           jobs the qualified, insured pros serving this ZIP can take — their daily capacity
 *           minus jobs already on their calendar and paid jobs still waiting for a pro.
 *           Each pro's day is split evenly across the three windows. Pros only count on the
 *           days and windows they work, outside their time off, and within their driving radius.
 * UPDATED : 2026-10-02_0301 UTC — same day (includeToday): today counts pros who are On call or
 *           working today, and only arrival windows that haven't started yet.
 * UPDATED : 2026-10-07_1900 UTC — the calendar's "today" and same-day cut-offs use the customer's time zone (Pacific in Washington).
 */
import { BRAND } from "./brand.ts";
import { eligible, offDuty } from "./dispatch.ts";
import { isRush } from "./pricing.ts";
import type { Contractor, TimeWindow } from "./types.ts";
import { localDate, localHour, onCall, timeZoneForZip } from "./roster.ts";

/** Local hour each arrival window starts — same-day bookings need it at least an hour ahead. */
const WINDOW_START: Record<string, number> = { morning: 8, midday: 11, afternoon: 14 };

export const WINDOWS: Exclude<TimeWindow, "flexible">[] = ["morning", "midday", "afternoon"];

export interface BookedJob {
  contractor_id: string | null;
  scheduled_date: string;
  time_window: TimeWindow;
}

export interface DaySlots {
  date: string;
  weekday: number;
  closed: boolean;
  rush: boolean;
  /** "request" = no pros on file for this area yet; ops confirms the time. */
  level: "open" | "limited" | "full" | "closed" | "request";
  spots: number;
  windows: Record<Exclude<TimeWindow, "flexible">, number>;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function buildAvailability(opts: {
  slug: string;
  zip: string;
  contractors: Contractor[];
  jobs: BookedJob[];
  /** ZIP centroid of the customer, for pros' driving radius. */
  lat?: number | null;
  lng?: number | null;
  start?: Date;
  days?: number;
  /** Start the calendar today (same-day work from on-call pros). */
  includeToday?: boolean;
  now?: Date;
}): { mode: "live" | "request"; pros: number; days: DaySlots[] } {
  const now = opts.now ?? new Date();
  const tz = timeZoneForZip(opts.zip); // Washington ZIPs: Pacific time
  const todayLocal = localDate(now, tz);
  const start = opts.start ?? (opts.includeToday ? new Date(`${todayLocal}T12:00:00Z`) : new Date(now.getTime() + 86400000));
  const days = opts.days ?? BRAND.bookingHorizonDays;
  const pros = opts.contractors.filter((c) => eligible(c, { service_slug: opts.slug, zip: opts.zip, scheduled_date: null, lat: opts.lat, lng: opts.lng }) === null);
  const out: DaySlots[] = [];

  for (let i = 0; i < days; i++) {
    const day = new Date(start.getTime() + i * 86400000);
    const date = iso(day);
    const weekday = new Date(`${date}T12:00:00`).getDay();
    const closed = BRAND.closedWeekdays.includes(weekday);
    const windows = { morning: 0, midday: 0, afternoon: 0 };
    let spots = 0;
    if (!closed && pros.length) {
      const todays = opts.jobs.filter((j) => j.scheduled_date === date);
      const isToday = date === todayLocal;
      const hourNow = isToday ? localHour(now, tz) : 0;
      for (const p of pros) {
        const callable = isToday && onCall(p, now);
        if (!callable && offDuty(p, date)) continue; // not working that day / time off (on call overrides today)
        const mine = todays.filter((j) => j.contractor_id === p.id);
        const dayLeft = Math.max(0, p.daily_capacity - mine.length);
        spots += dayLeft;
        const perWindow = Math.ceil(p.daily_capacity / WINDOWS.length);
        for (const w of WINDOWS) if ((!isToday || hourNow < WINDOW_START[w] - 1) && (callable || !offDuty(p, date, w))) windows[w] += Math.min(dayLeft, Math.max(0, perWindow - mine.filter((j) => j.time_window === w).length));
      }
      // today: only what's left in windows that haven't started
      if (isToday) spots = Math.min(spots, windows.morning + windows.midday + windows.afternoon);
      // paid jobs for this trade/area that don't have a pro yet still need someone's slot
      const waiting = todays.filter((j) => !j.contractor_id);
      spots = Math.max(0, spots - waiting.length);
      for (const j of waiting) if (j.time_window !== "flexible" && windows[j.time_window] > 0) windows[j.time_window]--;
    }
    const level: DaySlots["level"] = closed ? "closed" : !pros.length ? "request" : spots === 0 ? "full" : spots <= 2 ? "limited" : "open";
    out.push({ date, weekday, closed, rush: isRush(date), level, spots, windows });
  }
  return { mode: pros.length ? "live" : "request", pros: pros.length, days: out };
}
