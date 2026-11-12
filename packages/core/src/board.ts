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
 * UPDATED : 2026-11-10_0310 UTC — open offers (low name-your-price jobs) are on the board right away for 30 days, any date.
 * UPDATED : 2026-11-12_2000 UTC — higher pay goes first (PAY_PRIORITY): a customer who offers 10%+ above our suggested price
 *           gets offers to 3 pros at once with a 1-hour window, is on the board right away, and leads the board ("Top pay");
 *           the board sorts by top pay, then priority, then pay. Name-your-price posts get targeted offers too.
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

export interface BoardJob { status: string; contractor_id: string | null; paid_at?: string | null; deposit_paid_at?: string | null; billed_on_terms?: boolean | null; remedy?: string | null; scheduled_date: string | null;
  /** A name-your-price post: on the board at the customer's price until this time (targeted offers go out too). */
  open_offer_until?: string | null; customer_offer?: number | null; suggested_price?: number | null }

/**
 * Higher pay goes first. A customer who offers at least `topRatio` × our suggested price ("Top pay") gets offers to
 * `offerTo` pros at once with a `windowHours` window (so it moves through the area fast), is on the board right away
 * and leads it.
 */
export const PAY_PRIORITY = { topRatio: 1.1, offerTo: 3, windowHours: 1 } as const;

/** The customer's offer as a share of our suggested price (1.2 = 20% above), or null when they took our price. */
export function payRatio(job: { customer_offer?: number | string | null; suggested_price?: number | string | null }): number | null {
  const o = Number(job.customer_offer), s = Number(job.suggested_price);
  return o > 0 && s > 0 ? Math.round((o / s) * 100) / 100 : null;
}
export const topPay = (job: { customer_offer?: number | string | null; suggested_price?: number | string | null }) => (payRatio(job) ?? 0) >= PAY_PRIORITY.topRatio;

/** How many pros get the offer at once and for how long: urgent / business jobs and top pay go wider and faster. */
export function offerPlan(job: { priority?: string | null; customer_offer?: number | string | null; suggested_price?: number | string | null }, aiCount?: number | null): { count: number; hours: number } {
  const base = aiCount ?? (!job.priority || job.priority === "normal" ? 1 : 2);
  const top = topPay(job);
  return { count: top ? Math.max(base, PAY_PRIORITY.offerTo) : base, hours: top || (job.priority && job.priority !== "normal") ? PAY_PRIORITY.windowHours : 2 };
}

/** The board's order: top pay first, then priority (urgent / business), then the most pay; ties keep their order (date). */
export function boardOrder<T extends { topPay?: boolean; priority?: boolean; pay: number }>(cards: T[]): T[] {
  return cards.map((c, i) => ({ c, i })).sort((a, b) => Number(Boolean(b.c.topPay)) - Number(Boolean(a.c.topPay)) || Number(Boolean(b.c.priority)) - Number(Boolean(a.c.priority)) || b.c.pay - a.c.pay || a.i - b.i).map((x) => x.c);
}
export interface BoardOffer { kind?: string | null; status: string; offered_at: string }

/** Is this job on the open board right now? */
export function onBoard(job: BoardJob, offers: BoardOffer[], now = new Date()): boolean {
  if (job.status !== "dispatched" || job.contractor_id) return false;
  if (!job.paid_at && !job.deposit_paid_at && !job.billed_on_terms && !job.remedy) return false;
  // a name-your-price post: on the board for its whole window (the pro confirms the day with the customer)
  if (job.open_offer_until) return new Date(job.open_offer_until) > now;
  // top pay: on the board right away (once any first look is over)
  if (topPay(job) && !offers.some((o) => o.status === "offered" && (FIRST_LOOK_KINDS as readonly string[]).includes(o.kind ?? "job"))) {
    if (job.scheduled_date) { const day = new Date(`${job.scheduled_date}T23:59:59`); if (day < now || day.getTime() - now.getTime() > BOARD.horizonDays * 86400000) return false; }
    return true;
  }
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
