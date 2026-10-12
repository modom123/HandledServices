/*
 * FILE    : packages/core/src/scheduling-gaps.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-12_0005 UTC
 * PURPOSE : Pure rules behind the four scheduling gaps (tested in pricing.test.ts):
 *             phoneKey / smsKeyword     — match an incoming text to a customer or pro; STOP / START / HELP words
 *             twilioSignatureBase       — the string Twilio signs (URL + sorted POST params); HMAC is done server-side
 *             windowRange / localToUtc  — a job's time window as real start / end times in the job's time zone
 *             buildIcs                  — a pro's calendar feed (iCalendar, RFC 5545) for Google / Apple / Outlook
 *             homeAccessText / cleanHome — how a saved home profile becomes the entry details only the assigned pro sees
 */
import { timeZoneForZip } from "./roster.ts";

// ── 1. Two-way texting ───────────────────────────────────────────────────────

/** The last 10 digits of a US number ("(248) 555-0100", "+12485550100" → "2485550100"); null if it isn't one. */
export function phoneKey(phone: string | null | undefined): string | null {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length === 10) return d;
  if (d.length === 11 && d.startsWith("1")) return d.slice(1);
  return null;
}

/** Carrier keywords (Twilio also handles them; we mirror the opt-out on the profile). */
export function smsKeyword(body: string | null | undefined): "stop" | "start" | "help" | null {
  const w = (body ?? "").trim().toUpperCase().replace(/[.!]+$/, "");
  if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "OPTOUT", "REVOKE", "PARAR"].includes(w)) return "stop";
  if (["START", "UNSTOP", "YES", "SUBSCRIBE"].includes(w)) return "start";
  if (["HELP", "INFO", "AYUDA"].includes(w)) return "help";
  return null;
}

/** Twilio's request signature base: the full URL followed by each POST param name+value, sorted by name. */
export function twilioSignatureBase(url: string, params: Record<string, string>): string {
  return url + Object.keys(params).sort().map((k) => k + params[k]).join("");
}

// ── 4. Pro calendar feed ─────────────────────────────────────────────────────

/** Start and end hours (local) for each time window. "Flexible" spans the working day. */
export const WINDOW_RANGE: Record<string, [number, number]> = { morning: [8, 11], midday: [11, 14], afternoon: [14, 17], flexible: [8, 17] };

/** Offset of a time zone from UTC in minutes at a given instant (e.g. -240 for Detroit in summer). */
function zoneOffsetMinutes(at: Date, timeZone: string): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(at).filter((x) => x.type !== "literal").map((x) => [x.type, Number(x.value)]));
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - at.getTime()) / 60000;
}

/** A local wall-clock time (YYYY-MM-DD + hour) in a time zone, as a UTC instant. Handles daylight saving. */
export function localToUtc(date: string, hour: number, timeZone: string): Date {
  const guess = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00Z`);
  const first = new Date(guess.getTime() - zoneOffsetMinutes(guess, timeZone) * 60000);
  return new Date(guess.getTime() - zoneOffsetMinutes(first, timeZone) * 60000);
}

/** The job's window as UTC start / end, in the job's own time zone (from its ZIP). */
export function windowRange(j: { scheduled_date: string; time_window: string | null; zip?: string | null }): { start: Date; end: Date } {
  const [a, b] = WINDOW_RANGE[j.time_window ?? "flexible"] ?? WINDOW_RANGE.flexible;
  const tz = timeZoneForZip(j.zip);
  return { start: localToUtc(j.scheduled_date, a, tz), end: localToUtc(j.scheduled_date, b, tz) };
}

export interface IcsEvent { uid: string; start: Date; end: Date; summary: string; location?: string | null; description?: string | null; url?: string | null; cancelled?: boolean }

const icsTime = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
export const icsEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** Fold lines longer than 75 octets (RFC 5545 §3.1): continuation lines start with a space. */
function fold(line: string): string {
  const out: string[] = [];
  let cur = "", bytes = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (bytes + n > (out.length ? 74 : 75)) { out.push(cur); cur = ""; bytes = 0; }
    cur += ch; bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

/** A whole calendar (VCALENDAR) — CRLF line endings, folded lines, UTC times. */
export function buildIcs(name: string, events: IcsEvent[], now = new Date()): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Handled//Pro calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(name)}`, "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H"];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${icsTime(now)}`, `DTSTART:${icsTime(e.start)}`, `DTEND:${icsTime(e.end)}`, `SUMMARY:${icsEscape(e.summary)}`);
    if (e.location) lines.push(`LOCATION:${icsEscape(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${icsEscape(e.description)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push(`STATUS:${e.cancelled ? "CANCELLED" : "CONFIRMED"}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

// ── 3. Saved home profiles ───────────────────────────────────────────────────

export interface HomeProfile {
  label?: string | null; address: string; city: string; state: string; zip: string;
  entry_instructions?: string | null; key_info?: string | null; key_holder?: string | null;
  pets?: string | null; parking?: string | null; preferences?: string | null;
}

const trimTo = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "") || null;

/** Trim and cap every field; empty strings become null. */
export function cleanHome(h: Partial<HomeProfile>): HomeProfile {
  return {
    label: trimTo(h.label, 60) ?? "Home",
    address: trimTo(h.address, 200) ?? "", city: trimTo(h.city, 80) ?? "", state: (trimTo(h.state, 2) ?? "").toUpperCase(), zip: (trimTo(h.zip, 10) ?? "").slice(0, 5),
    entry_instructions: trimTo(h.entry_instructions, 1000), key_info: trimTo(h.key_info, 500), key_holder: trimTo(h.key_holder, 200),
    pets: trimTo(h.pets, 500), parking: trimTo(h.parking, 500), preferences: trimTo(h.preferences, 1000),
  };
}

/** Entry details for the assigned pro only (lockbox codes, key, entry) — never put on offers or public pages. */
export function homeAccessText(h: Partial<HomeProfile>): string | null {
  const rows: [string, string | null | undefined][] = [["Entry", h.entry_instructions], ["Key / lockbox", h.key_info], ["Key holder", h.key_holder]];
  const s = rows.filter(([, v]) => v && v.trim()).map(([k, v]) => `${k}: ${v!.trim()}`).join("\n");
  return s || null;
}

/** What every pro may see before accepting (pets, parking, preferences) — goes into the job notes. */
export function homeNotesText(h: Partial<HomeProfile>): string | null {
  const rows: [string, string | null | undefined][] = [["Pets", h.pets], ["Parking", h.parking], ["Preferences", h.preferences]];
  const s = rows.filter(([, v]) => v && v.trim()).map(([k, v]) => `${k}: ${v!.trim()}`).join("\n");
  return s || null;
}
