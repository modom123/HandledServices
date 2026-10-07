/*
 * FILE    : packages/core/src/board.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-04_2204 UTC
 * PURPOSE : Two ways a job finds its pro beyond the targeted offers, and the rules for both:
 *             Open job board — a paid job nobody has taken after the first targeted round shows on
 *               "Jobs near you" for every pro who qualifies (trade, license, insurance, distance, days,
 *               daily limit). First to take it gets it. First-look windows (recurring pro, redo,
 *               a business's dedicated pros, a customer's favorite) are always respected first.
 *             Favorites — any customer can favorite a pro (or a crew member of a pro company). Their
 *               next booking goes to that pro first for a short window, then to everyone. Never forced:
 *               the pro can pass at no cost, and a requested crew member is a request to the company
 *               owner, who decides who goes.
 */

export const BOARD = {
  /** A job joins the board this long after its first targeted offers went out (if still untaken). */
  afterMinutes: 30,
  /** How far ahead the board shows jobs. */
  horizonDays: 14,
  /** A claim from the board is held for the pro this long while they read the work order. */
  claimMinutes: 15,
} as const;

export const FAVORITES = {
  /** How long a favorite pro sees the job before everyone else. */
  firstLookHours: 4,
  /** If the job is sooner than this, the window shrinks so the job still gets covered. */
  minLeadHours: 24,
} as const;

/** Offer kinds that are a first look for one specific pro (or a business's team): the board waits for them. */
export const FIRST_LOOK_KINDS = ["recurring", "redo", "account", "favorite"] as const;

export interface BoardJob { status: string; contractor_id: string | null; paid_at?: string | null; deposit_paid_at?: string | null; billed_on_terms?: boolean | null; remedy?: string | null; scheduled_date: string | null }
export interface BoardOffer { kind?: string | null; status: string; offered_at: string }

/** Is this job on the open board right now? */
export function onBoard(job: BoardJob, offers: BoardOffer[], now = new Date()): boolean {
  if (job.status !== "dispatched" || job.contractor_id) return false;
  if (!job.paid_at && !job.deposit_paid_at && !job.billed_on_terms && !job.remedy) return false;
  if (job.scheduled_date) {
    const day = new Date(`${job.scheduled_date}T23:59:59`);
    if (day < now || day.getTime() - now.getTime() > BOARD.horizonDays * 86400000) return false;
  }
  if (offers.some((o) => o.status === "offered" && (FIRST_LOOK_KINDS as readonly string[]).includes(o.kind ?? "job"))) return false;
  // the first targeted round (not first looks, not board claims): the board opens 30 minutes after it went out
  const targeted = offers.filter((o) => o.kind !== "board" && !(FIRST_LOOK_KINDS as readonly string[]).includes(o.kind ?? "job"));
  const first = targeted.reduce<string | null>((a, o) => (a && a < o.offered_at ? a : o.offered_at), null);
  if (!first) return true; // never offered, or only first looks that lapsed: open to anyone who qualifies
  return now.getTime() - new Date(first).getTime() >= BOARD.afterMinutes * 60000 || !targeted.some((o) => o.status === "offered");
}

/** The favorite's first-look window for a job on this date (shorter when the job is close). */
export function favoriteWindowHours(scheduledDate: string | null, now = new Date()): number {
  if (!scheduledDate) return FAVORITES.firstLookHours;
  const hoursAway = (new Date(`${scheduledDate}T09:00:00`).getTime() - now.getTime()) / 3600000;
  if (hoursAway <= FAVORITES.minLeadHours) return 1;
  return FAVORITES.firstLookHours;
}
