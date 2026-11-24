/*
 * FILE    : packages/core/src/call-schedule.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_1530 UTC
 * PURPOSE : Call appointments — customers book a time for a Handled person to call them (Post your project, the AI
 *           project manager). Pure functions, shared by web + mobile:
 *             CallHours / DEFAULT_CALL_HOURS / cleanCallHours — when we take calls (per weekday, in our time zone),
 *                                 slot length, how many people take calls at once, minimum notice, how far ahead
 *             callSlots      — the open times over the horizon, minus calls already booked (capacity per slot)
 *             isOpenCallSlot — a requested time is a real, still-open slot (checked again on the server)
 *             formatCallTime / callCalendarLinks — "Tue, Nov 18, 2:30 PM ET" and Add-to-calendar links (Google + .ics)
 *           Calls are made live by a person (no autodialer, no AI or prerecorded voice), at the time the customer chose.
 */
import { BRAND } from "./brand.ts";

/** Weekday 0 (Sunday) … 6 (Saturday) → ["HH:MM", "HH:MM"] open–close, or null when closed. */
export type CallHours = {
  tz: string;
  slotMinutes: number;
  callers: number;
  minNoticeMinutes: number;
  horizonDays: number;
  days: (readonly [string, string] | null)[];
};

export const DEFAULT_CALL_HOURS: CallHours = {
  tz: "America/Detroit",
  slotMinutes: 30,
  callers: 1,
  minNoticeMinutes: 60,
  horizonDays: 14,
  days: [null, ["09:00", "18:00"], ["09:00", "18:00"], ["09:00", "18:00"], ["09:00", "18:00"], ["09:00", "18:00"], ["10:00", "14:00"]],
};

export const CALL_SLOT_CHOICES = [15, 20, 30, 45, 60] as const;

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const toMin = (s: string) => { const m = HHMM.exec(s); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
const validTz = (tz: unknown): tz is string => { if (typeof tz !== "string" || !tz) return false; try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; } };
const clampInt = (v: unknown, lo: number, hi: number, d: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

/** Settings from the Hub (site_settings "call_hours") → safe hours; anything missing or wrong falls back to the default. */
export function cleanCallHours(raw: unknown): CallHours {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof CallHours, unknown>>;
  const d = DEFAULT_CALL_HOURS;
  const days = Array.isArray(r.days) && r.days.length === 7
    ? r.days.map((x) => (Array.isArray(x) && x.length === 2 && HHMM.test(String(x[0])) && HHMM.test(String(x[1])) && toMin(String(x[0])) < toMin(String(x[1])) ? [String(x[0]), String(x[1])] as const : null))
    : d.days;
  return {
    tz: validTz(r.tz) ? r.tz : d.tz,
    slotMinutes: (CALL_SLOT_CHOICES as readonly number[]).includes(Number(r.slotMinutes)) ? Number(r.slotMinutes) : d.slotMinutes,
    callers: clampInt(r.callers, 1, 20, d.callers),
    minNoticeMinutes: clampInt(r.minNoticeMinutes, 0, 2880, d.minNoticeMinutes),
    horizonDays: clampInt(r.horizonDays, 1, 60, d.horizonDays),
    days,
  };
}

/** The UTC instant of a wall-clock time (date + minutes after midnight) in a time zone, DST-safe. */
export function zonedMinute(date: string, minutes: number, timeZone: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const guess = new Date(Date.UTC(y, mo - 1, d, Math.floor(minutes / 60), minutes % 60));
  const offset = (at: Date) => {
    const p = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(at);
    const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
    return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute")) - at.getTime();
  };
  const first = new Date(guess.getTime() - offset(guess));
  return new Date(guess.getTime() - offset(first)); // second pass settles DST edges
}

const localDay = (at: Date, timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
const addDay = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

export type CallSlot = { at: string; left: number };
export type CallDay = { date: string; slots: CallSlot[] };

/** Open call times over the horizon (only days with at least one free slot), minus calls already booked. */
export function callSlots(h: CallHours, booked: (string | Date)[], now: Date = new Date()): CallDay[] {
  const taken = new Map<number, number>();
  for (const b of booked) { const t = new Date(b).getTime(); if (Number.isFinite(t)) taken.set(t, (taken.get(t) ?? 0) + 1); }
  const earliest = now.getTime() + h.minNoticeMinutes * 60000;
  const today = localDay(now, h.tz);
  const out: CallDay[] = [];
  for (let i = 0; i <= h.horizonDays; i++) {
    const date = addDay(today, i);
    const open = h.days[weekday(date)];
    if (!open) continue;
    const slots: CallSlot[] = [];
    for (let m = toMin(open[0]); m + h.slotMinutes <= toMin(open[1]); m += h.slotMinutes) {
      const at = zonedMinute(date, m, h.tz);
      if (at.getTime() < earliest) continue;
      const left = h.callers - (taken.get(at.getTime()) ?? 0);
      if (left > 0) slots.push({ at: at.toISOString(), left });
    }
    if (slots.length) out.push({ date, slots });
  }
  return out;
}

/** True when `at` is one of the open slots right now (server re-check before saving a booking). */
export function isOpenCallSlot(h: CallHours, booked: (string | Date)[], at: string, now: Date = new Date()): boolean {
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return false;
  return callSlots(h, booked, now).some((d) => d.slots.some((s) => Date.parse(s.at) === t));
}

/** "Tue, Nov 18, 2:30 PM EST" (or Spanish) in the given time zone. */
export function formatCallTime(at: string | Date, timeZone: string, locale: "en" | "es" = "en"): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", { timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(at));
}

const icsStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (c) => `\\${c}`);

/** Add-to-calendar for a booked call: a Google Calendar link and an .ics file body (Apple / Outlook). */
export function callCalendarLinks(o: { at: string | Date; minutes: number; title?: string; details?: string; uid?: string }) {
  const start = new Date(o.at);
  const end = new Date(start.getTime() + o.minutes * 60000);
  const title = o.title ?? `Call with ${BRAND.name} about your project`;
  const details = o.details ?? `${BRAND.name} will call you at this time${BRAND.supportPhone ? ` from ${BRAND.supportPhone}` : ""}.`;
  const google = `https://calendar.google.com/calendar/render?${new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${icsStamp(start)}/${icsStamp(end)}`, details })}`;
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//${BRAND.name}//Calls//EN`, "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${o.uid ?? `${start.getTime()}-call`}@handled`, `DTSTAMP:${icsStamp(new Date())}`, `DTSTART:${icsStamp(start)}`, `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsText(title)}`, `DESCRIPTION:${icsText(details)}`,
    "BEGIN:VALARM", "TRIGGER:-PT15M", "ACTION:DISPLAY", `DESCRIPTION:${icsText(title)}`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  return { google, ics };
}
