/*
 * FILE    : packages/core/src/coverage.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-06_1950 UTC
 * PURPOSE : Every job gets done. The rules, kept pure and tested:
 *             CANCEL_POLICY / cancelTier — a pro can hand a job back:
 *                 24h+ before the arrival window   → free (nothing recorded against them)
 *                 6–24h before                     → short notice: logged, no penalty, never counts toward a warning
 *                 under 6h (or after it started)   → late cancel: counts toward a written warning (3 in 90 days)
 *               Never a fine or a pay deduction (independent-contractor safeguard); emergencies can be excused by staff.
 *             BACKUPS — each accepted job lines up backup #1, #2 and #3 (pros who say "I can cover if needed").
 *               If the pro hands it back or no-shows, backup #1 is called first, then #2, then #3, then everyone.
 *               How long each backup has to answer shrinks as the job gets closer (backupAnswerMinutes).
 *             Credit follows the work: pay, rating, tier progress and Rewards points go to the pro who
 *               actually completes the job — never to one who handed it back.
 *             hoursUntilWindow — hours until the arrival window opens, in the job's local time zone
 *               (servers run in UTC; "6 hours before" must mean 6 real hours).
 * UPDATED : 2026-10-07_1900 UTC — hoursUntilWindow uses the job's own time zone (Pacific for Washington ZIPs).
 */
import { OPS_TIME_ZONE } from "./pro-stats.ts";
import { timeZoneForZip } from "./roster.ts";

export const CANCEL_POLICY = {
  /** At least this many hours before the arrival window: free. */
  freeHours: 24,
  /** Under this many hours: a late cancel (counts toward standing). Between the two: short notice, no penalty. */
  lateHours: 6,
} as const;

export type CancelTier = "free" | "short_notice" | "late";

export function cancelTier(hoursLeft: number, p = CANCEL_POLICY): CancelTier {
  if (hoursLeft >= p.freeHours) return "free";
  if (hoursLeft >= p.lateHours) return "short_notice";
  return "late";
}

/** What the pro sees before handing a job back (plain words, EN / ES). */
export function cancelNotice(tier: CancelTier, locale: "en" | "es" = "en", p = CANCEL_POLICY): string {
  const es = locale === "es";
  if (tier === "free") return es ? `Faltan más de ${p.freeHours} horas: sin penalidad. Su respaldo o el siguiente profesional lo toma.` : `More than ${p.freeHours} hours out: no penalty. Your backup or the next pro takes it.`;
  if (tier === "short_notice") return es ? `Aviso con poca anticipación (${p.lateHours}–${p.freeHours} h): queda registrado, pero no cuenta para una advertencia. Llamamos a su respaldo de inmediato.` : `Short notice (${p.lateHours}–${p.freeHours} h): it's noted, but it doesn't count toward a warning. We call your backup right away.`;
  return es ? `Menos de ${p.lateHours} horas: cuenta como cancelación tardía (3 en 90 días llevan a una advertencia por escrito). ¿Es una emergencia? Díganos y lo excusamos.` : `Under ${p.lateHours} hours: this counts as a late cancel (3 in 90 days leads to a written warning). An emergency? Tell us and we'll excuse it.`;
}

export const BACKUPS = {
  /** Backups lined up behind the pro on every job. */
  count: 3,
  /** Backups who haven't confirmed are still asked, after the confirmed ones. */
} as const;

/** Minutes a backup gets to accept when called — less the closer the job is. */
export function backupAnswerMinutes(hoursLeft: number): number {
  if (hoursLeft < 3) return 15;
  if (hoursLeft < 6) return 20;
  if (hoursLeft < 24) return 45;
  return 120;
}

export interface BackupRow { contractor_id: string; rank: number; status: "asked" | "standby" | "called" | "declined" | "passed" | "promoted" | "released" }

/** Who to call next: confirmed standbys by rank, then backups who were asked but haven't answered. Never anyone excluded. */
export function nextBackup(rows: BackupRow[], exclude: string[] = []): BackupRow | null {
  const ok = rows.filter((r) => !exclude.includes(r.contractor_id));
  const by = (st: BackupRow["status"]) => ok.filter((r) => r.status === st).sort((a, b) => a.rank - b.rank)[0];
  return by("standby") ?? by("asked") ?? null;
}

/** Ranks still open (1..count) for new backups. */
export function openBackupRanks(rows: BackupRow[], count = BACKUPS.count): number[] {
  const live = new Set(rows.filter((r) => ["asked", "standby", "called"].includes(r.status)).map((r) => r.rank));
  return Array.from({ length: count }, (_, i) => i + 1).filter((r) => !live.has(r));
}

const WINDOW_START: Record<string, number> = { morning: 8, midday: 11, afternoon: 14, flexible: 8 };

/** UTC instant of a local wall-clock time in `timeZone` (DST-correct). */
export function zonedInstant(date: string, hour: number, timeZone = OPS_TIME_ZONE): Date {
  const guess = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asLocal = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess.getTime() - (asLocal - guess.getTime()));
}

/** Hours from `now` until the job's arrival window opens (Infinity when it has no date). */
export function hoursUntilWindow(job: { scheduled_date?: string | null; time_window?: string | null; zip?: string | null }, now = new Date(), timeZone = job.zip ? timeZoneForZip(job.zip) : OPS_TIME_ZONE): number {
  if (!job.scheduled_date) return Infinity;
  const start = zonedInstant(job.scheduled_date, WINDOW_START[job.time_window ?? "morning"] ?? 8, timeZone);
  return (start.getTime() - now.getTime()) / 3600000;
}
