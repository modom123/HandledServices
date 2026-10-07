/*
 * FILE    : packages/core/src/partners.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-07_0100 UTC
 * PURPOSE : Referral Partner Program rules, shared by web, app and Hub. Anyone (realtors, property managers,
 *           contractors, neighbors) can sign up, share their link or send us a customer, and earn:
 *             • 10% of Handled's take (price − pro payout − refunds) on every completed job from that customer,
 *             • for 12 months from the first referral,
 *             • paid in the weekly Stripe run once the job is past the 30-day make-it-right window.
 *           It comes out of our share, never the pro's pay, so a referred job can never lose money.
 */
import { BRAND } from "./brand.ts";

export const PARTNER_PROGRAM = {
  pctOfTake: 0.1,          // 10% of what Handled keeps on the job
  months: 12,              // every job from a referred customer pays for this long
  holdDays: BRAND.guaranteeDays, // paid after the make-it-right window, so refunds come first
  minPayout: 25,           // smaller balances roll to the next weekly run (keeps Stripe fees sensible)
  cookieDays: 90,          // a click on a partner link counts for this long
  termsVersion: "partner-v1",
} as const;

export const PARTNER_KINDS = {
  realtor: "Real estate agent",
  property_manager: "Property manager / HOA",
  contractor: "Contractor or tradesperson",
  business: "Business owner",
  customer: "Handled customer",
  pro: "Handled pro",
  other: "Someone else",
} as const;
export type PartnerKind = keyof typeof PARTNER_KINDS;

const cents = (n: number) => Math.round(n * 100);

/** What Handled keeps on a job after the pro's payout and any refunds (never below 0). */
export function partnerTake(o: { price: number; payout: number; refunded?: number }): number {
  return Math.max(0, cents(o.price) - cents(o.payout) - cents(o.refunded ?? 0)) / 100;
}

/** The partner's commission on a job: 10% of our take, rounded down to the cent. */
export function partnerCommission(o: { price: number; payout: number; refunded?: number }): number {
  return Math.floor(cents(partnerTake(o)) * PARTNER_PROGRAM.pctOfTake) / 100;
}

/** A partner code: letters from the name + 4 random characters, e.g. "JANE7K2Q". No look-alike characters. */
export function makePartnerCode(name: string, rand: () => number = Math.random): string {
  const head = name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5) || "HND";
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let tail = "";
  for (let i = 0; i < 4; i++) tail += abc[Math.floor(rand() * abc.length)];
  return head + tail;
}

/** Codes are case-insensitive; anything that isn't a plausible code is ignored. */
export function cleanPartnerCode(v: unknown): string | null {
  const s = String(v ?? "").trim().toUpperCase();
  return /^[A-Z0-9]{4,16}$/.test(s) ? s : null;
}

/** When a referral stops paying (12 months after it started). */
export function partnerExpiry(start: Date): Date {
  const d = new Date(start);
  d.setUTCMonth(d.getUTCMonth() + PARTNER_PROGRAM.months);
  return d;
}

/** The partner terms shown at sign-up (plain English). */
export function partnerTerms(): string[] {
  const p = PARTNER_PROGRAM;
  return [
    `You earn ${p.pctOfTake * 100}% of ${BRAND.name}'s fee (the job price minus what the pro is paid and any refunds) on every completed job from a customer you refer, for ${p.months} months from their first referral.`,
    `A customer counts as yours when they book through your link (within ${p.cookieDays} days of clicking it) or after you send them to us from your partner page, and they are new to ${BRAND.name}. Each customer belongs to one partner: the first one.`,
    `Commissions are paid weekly through Stripe once the job is ${p.holdDays} days past completion (our make-it-right window). Balances under $${p.minPayout} carry over to the next week. Refunds and chargebacks reduce or cancel the commission on that job.`,
    "Referring yourself, your own household or your own business doesn't count. No spam, fake reviews, or promises about price or service that we didn't make. Breaking these rules ends the partnership and any unpaid commissions.",
    `You're an independent referral partner, not an employee or agent of ${BRAND.name}. If we pay you $600 or more in a year, we'll need your tax details (collected by Stripe) and send you a 1099.`,
    "We may change these terms with 30 days' notice by email. Commissions already earned are paid under the terms in place when the job was booked.",
  ];
}
