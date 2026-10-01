/*
 * FILE    : packages/core/src/availability.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2115 UTC
 * PURPOSE : Booking-calendar availability. For each day and arrival window, how many more
 *           jobs the qualified, insured pros serving this ZIP can take — their daily capacity
 *           minus jobs already on their calendar and paid jobs still waiting for a pro.
 *           Each pro's day is split evenly across the three windows. Pros only count on the
 *           days and windows they work, outside their time off, and within their driving radius.
 */
import { BRAND } from "./brand.ts";
import { eligible, offDuty } from "./dispatch.ts";
import { isRush } from "./pricing.ts";
import type { Contractor, TimeWindow } from "./types.ts";

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
}): { mode: "live" | "request"; pros: number; days: DaySlots[] } {
  const start = opts.start ?? new Date(Date.now() + 86400000);
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
      for (const p of pros) {
        if (offDuty(p, date)) continue; // not working that day / time off
        const mine = todays.filter((j) => j.contractor_id === p.id);
        const dayLeft = Math.max(0, p.daily_capacity - mine.length);
        spots += dayLeft;
        const perWindow = Math.ceil(p.daily_capacity / WINDOWS.length);
        for (const w of WINDOWS) if (!offDuty(p, date, w)) windows[w] += Math.min(dayLeft, Math.max(0, perWindow - mine.filter((j) => j.time_window === w).length));
      }
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
