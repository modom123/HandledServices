/*
 * FILE    : packages/core/src/growth.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_0316 UTC
 * PURPOSE : Customer money features, as plain rules shared by web, app and Hub:
 *             HANDLED_PLUS        — monthly membership: no priority fees + % off every job
 *             promoDiscount()     — promo codes (percent / amount, first-job, minimum, expiry)
 *             capDiscount()       — every discount comes out of OUR share, never the pro's pay,
 *                                   and we always keep at least DISCOUNT_FLOOR of the price
 *             REFERRAL            — give $25, get $25
 *             TIP_PRESETS         — 100% of tips go to the pro
 *           Gift cards are prepaid money (not a discount): they reduce what's charged, not the
 *           price, so the pro and our share are unchanged.
 */
import { BRAND } from "./brand.ts";

export const HANDLED_PLUS = {
  name: `${BRAND.name} Plus`,
  monthly: 19,
  discountPct: 0.1,
  waivesRush: true,
  perks: ["No priority fees — same-day and next-day at the normal price", "10% off every job (on top of plan discounts)", "Members are offered first for same-day slots", "Cancel anytime"],
} as const;

/** After every discount we still keep at least this share of the job's list price. */
export const DISCOUNT_FLOOR = 0.05;

export const REFERRAL = { friendOff: 25, reward: 25, maxRewardsPerYear: 20 } as const;

export const TIP_PRESETS = [5, 10, 20] as const;
export const TIP_MAX = 500;

export interface PromoCode {
  code: string;
  kind: "percent" | "amount" | "gift";
  value: number;
  balance?: number | null;
  max_uses?: number | null;
  uses?: number;
  first_job_only?: boolean;
  min_order?: number;
  expires_at?: string | null;
  active?: boolean;
  source?: string;
}

/** The most we can take off a job and still keep DISCOUNT_FLOOR after paying the pro. */
export function capDiscount(listPrice: number, payout: number, wanted: number): number {
  const room = Math.floor(listPrice - payout - listPrice * DISCOUNT_FLOOR);
  return Math.max(0, Math.min(Math.round(wanted), room));
}

/** Validate a promo code for this order. Gift cards are handled separately (prepaid balance). */
export function promoDiscount(p: PromoCode | null, listPrice: number, ctx: { firstJob: boolean; now?: Date }): { ok: boolean; amount: number; message: string } {
  const now = ctx.now ?? new Date();
  if (!p || p.active === false) return { ok: false, amount: 0, message: "That code isn't valid." };
  if (p.expires_at && new Date(p.expires_at) < now) return { ok: false, amount: 0, message: "That code has expired." };
  if (p.max_uses != null && (p.uses ?? 0) >= p.max_uses) return { ok: false, amount: 0, message: "That code has been used up." };
  if (p.first_job_only && !ctx.firstJob) return { ok: false, amount: 0, message: "That code is for first-time customers." };
  if (p.min_order && listPrice < p.min_order) return { ok: false, amount: 0, message: `That code needs an order of $${p.min_order} or more.` };
  if (p.kind === "gift") return (p.balance ?? 0) > 0 ? { ok: true, amount: Math.min(p.balance ?? 0, listPrice), message: `Gift card: $${p.balance} available.` } : { ok: false, amount: 0, message: "That gift card has no balance left." };
  const amount = p.kind === "percent" ? Math.round(listPrice * Math.min(100, p.value) / 100) : Math.min(p.value, listPrice);
  return { ok: true, amount, message: p.kind === "percent" ? `${p.value}% off` : `$${p.value} off` };
}

/** Plus member saving on a job: the rush fee back plus the member %, from our share. */
export function memberSaving(listPrice: number, rushFee: number): number {
  return Math.round((HANDLED_PLUS.waivesRush ? rushFee : 0) + (listPrice - rushFee) * HANDLED_PLUS.discountPct);
}

/** Human-friendly code: no 0/O/1/I. */
export function makeCode(prefix: string, len = 8, rand: () => number = Math.random): string {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += A[Math.floor(rand() * A.length)];
  return `${prefix}-${s.slice(0, 4)}${len > 4 ? `-${s.slice(4)}` : ""}`;
}
