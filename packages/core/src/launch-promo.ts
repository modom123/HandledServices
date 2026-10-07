/*
 * FILE    : packages/core/src/launch-promo.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-07_0300 UTC
 * PURPOSE : Grand opening promotion: X% off every booking for N days from a start date, with a countdown on the site;
 *           when it ends, the banner switches to the Grand Opening message for a few weeks.
 *           By default the discount comes out of OUR share only and stops where we'd keep less than 5% of the price
 *           ("up to X% off" — some services keep under 20%). With fullDiscount on, every customer gets the full X% and we
 *           cover any shortfall; the pro is always paid their full payout either way.
 */
import { DISCOUNT_FLOOR } from "./growth.ts";
import { zonedInstant } from "./coverage.ts";

export type LaunchPromo = { enabled: boolean; start: string; days: number; pct: number; fullDiscount?: boolean };
export const LAUNCH_PROMO_DEFAULT: LaunchPromo = { enabled: false, start: "", days: 100, pct: 0.2, fullDiscount: false };
/** How long the "Grand Opening — we're open" banner shows after the countdown ends. */
export const GRAND_OPENING_BANNER_DAYS = 30;

export type LaunchPhase = "off" | "upcoming" | "active" | "grand_opening" | "done";

/** Where the promotion stands right now. Days run in the business time zone; the window ends at the start of day N+1. */
export function launchState(p: LaunchPromo | null | undefined, now = new Date()) {
  if (!p?.enabled || !/^\d{4}-\d{2}-\d{2}$/.test(p.start ?? "")) return { phase: "off" as LaunchPhase, startsAt: null, endsAt: null, pct: 0, full: false };
  // midnight in the business time zone (Detroit), daylight saving handled
  const startsAt = zonedInstant(p.start, 0);
  const end = new Date(Date.parse(`${p.start}T12:00:00Z`) + p.days * 86400000).toISOString().slice(0, 10);
  const endsAt = zonedInstant(end, 0);
  const bannerUntil = new Date(endsAt.getTime() + GRAND_OPENING_BANNER_DAYS * 86400000);
  const phase: LaunchPhase = now < startsAt ? "upcoming" : now < endsAt ? "active" : now < bannerUntil ? "grand_opening" : "done";
  return { phase, startsAt, endsAt, pct: p.pct, full: Boolean(p.fullDiscount) };
}

/** The grand opening discount on a price (whole dollars, never more than the price; capped at our share unless full). */
export function launchDiscount(o: { price: number; payout: number; pct: number; full?: boolean }): number {
  const wanted = Math.round(o.price * o.pct);
  if (o.full) return Math.max(0, Math.min(wanted, Math.floor(o.price)));
  const room = Math.floor(o.price - o.payout - o.price * DISCOUNT_FLOOR);
  return Math.max(0, Math.min(wanted, room));
}

/** "87d 04h 12m" style countdown parts. */
export function countdownParts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}
