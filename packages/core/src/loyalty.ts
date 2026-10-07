/*
 * FILE    : packages/core/src/loyalty.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0530 UTC
 * PURPOSE : Handled Points — loyalty points for every customer account (people and business accounts).
 *           (Pros have their own program: rewards.ts.)
 *             earn      1 point per $1 paid on a completed job (tips and refunds don't count)
 *             tiers     by points earned in the last 12 months: Member 1× · Silver 1.25× (1,000+) · Gold 1.5× (3,000+)
 *             bonuses   +100 on the account's first completed job · +25 for rating the pro
 *             pending   30 days (the make-it-right window); a refunded or cancelled job's points are voided
 *             redeem    in blocks of 500 points = $5 credit code (100 points ≈ $1) — about 1–1.5% back
 *             expire    after 18 months with no completed job
 *           Credits are applied at checkout like a gift card: they come out of OUR share; the pro's pay never changes.
 *           A job booked for a business account earns for the business account; anything else earns for the person.
 */

export interface LoyaltySettings {
  enabled: boolean;
  /** Points per $1 paid. */
  earnRate: number;
  /** Dollars of credit per point. */
  pointValue: number;
  /** Points per redemption block. */
  redeemStep: number;
  pendingDays: number;
  inactivityExpiryMonths: number;
  firstJobBonus: number;
  reviewBonus: number;
}

export const LOYALTY_DEFAULTS: LoyaltySettings = {
  enabled: true,
  earnRate: 1,
  pointValue: 0.01,
  redeemStep: 500,
  pendingDays: 30,
  inactivityExpiryMonths: 18,
  firstJobBonus: 100,
  reviewBonus: 25,
};

export const mergeLoyalty = (s?: Partial<LoyaltySettings> | null): LoyaltySettings => ({ ...LOYALTY_DEFAULTS, ...(s ?? {}) });

export const LOYALTY_TIERS = [
  { key: "member", min: 0, multiplier: 1, en: "Member", es: "Miembro" },
  { key: "silver", min: 1000, multiplier: 1.25, en: "Silver", es: "Plata" },
  { key: "gold", min: 3000, multiplier: 1.5, en: "Gold", es: "Oro" },
] as const;

/** Tier from points earned in the last 12 months (earn + bonus, before redemptions). */
export function loyaltyTier(earned12m: number) {
  const i = LOYALTY_TIERS.reduce((at, t, k) => (earned12m >= t.min ? k : at), 0);
  const next = LOYALTY_TIERS[i + 1] ?? null;
  return { ...LOYALTY_TIERS[i], next, toNext: next ? Math.max(0, next.min - earned12m) : 0 };
}

/** What counts toward points: what the customer paid for the work, less refunds (tips are the pro's). */
export const paidForPoints = (j: { price_final?: number | null; amount_refunded?: number | null }) =>
  Math.max(0, Math.round((Number(j.price_final ?? 0) - Number(j.amount_refunded ?? 0)) * 100) / 100);

export function loyaltyPointsForJob(paid: number, earned12m: number, s: LoyaltySettings = LOYALTY_DEFAULTS) {
  const tier = loyaltyTier(earned12m);
  const base = Math.floor(paid * s.earnRate);
  return { base, multiplier: tier.multiplier, tier: tier.key, points: Math.floor(base * tier.multiplier) };
}

export const loyaltyDollars = (points: number, s: LoyaltySettings = LOYALTY_DEFAULTS) => Math.round(points * s.pointValue * 100) / 100;

/** Points that can be turned into credit now: whole blocks of redeemStep. */
export const redeemable = (available: number, s: LoyaltySettings = LOYALTY_DEFAULTS) => Math.max(0, Math.floor(available / s.redeemStep) * s.redeemStep);

/** Check a redemption request. */
export function checkRedeem(points: number, available: number, s: LoyaltySettings = LOYALTY_DEFAULTS): { ok: boolean; message: string; credit: number } {
  if (!s.enabled) return { ok: false, message: "Points are paused right now.", credit: 0 };
  if (!Number.isInteger(points) || points <= 0 || points % s.redeemStep) return { ok: false, message: `Redeem in blocks of ${s.redeemStep} points.`, credit: 0 };
  if (points > available) return { ok: false, message: `You have ${available.toLocaleString("en-US")} points available.`, credit: 0 };
  return { ok: true, message: "", credit: loyaltyDollars(points, s) };
}

export type LoyaltyKind = "earn" | "bonus" | "redeem" | "adjust" | "expire";

export interface LoyaltyEntry { kind: LoyaltyKind; points: number; status: "pending" | "available" | "void"; created_at: string }

/** Balance from ledger rows: available, pending, lifetime earned, earned in the last 12 months. */
export function loyaltyBalance(rows: LoyaltyEntry[], now: Date = new Date()) {
  const yearAgo = now.getTime() - 365 * 86400000;
  let available = 0, pending = 0, lifetime = 0, earned12m = 0, redeemed = 0;
  for (const r of rows) {
    if (r.status === "void") continue;
    if (r.status === "pending") pending += r.points;
    else available += r.points;
    if (r.kind === "earn" || r.kind === "bonus") {
      lifetime += r.points;
      if (new Date(r.created_at).getTime() >= yearAgo) earned12m += r.points;
    }
    if (r.kind === "redeem" && r.status !== "pending") redeemed -= r.points;
  }
  return { available: Math.max(0, available), pending, lifetime, earned12m, redeemed };
}

export const LOYALTY_RULES_EN = (s: LoyaltySettings = LOYALTY_DEFAULTS) => [
  `Earn ${s.earnRate} point for every $1 you pay on a completed job.`,
  `Silver (${LOYALTY_TIERS[1].min.toLocaleString("en-US")}+ points in 12 months) earns ×${LOYALTY_TIERS[1].multiplier}; Gold (${LOYALTY_TIERS[2].min.toLocaleString("en-US")}+) earns ×${LOYALTY_TIERS[2].multiplier}.`,
  `Bonus: +${s.firstJobBonus} on your first completed job, +${s.reviewBonus} when you rate your pro.`,
  `New points are pending for ${s.pendingDays} days, then ready to use. Refunded jobs don't earn points.`,
  `Turn every ${s.redeemStep.toLocaleString("en-US")} points into a $${loyaltyDollars(s.redeemStep, s)} credit for your next booking.`,
  `Points expire after ${s.inactivityExpiryMonths} months with no completed job. They have no cash value.`,
];
export const LOYALTY_RULES_ES = (s: LoyaltySettings = LOYALTY_DEFAULTS) => [
  `Gane ${s.earnRate} punto por cada $1 que paga en un trabajo completado.`,
  `Plata (${LOYALTY_TIERS[1].min.toLocaleString("en-US")}+ puntos en 12 meses) gana ×${LOYALTY_TIERS[1].multiplier}; Oro (${LOYALTY_TIERS[2].min.toLocaleString("en-US")}+) gana ×${LOYALTY_TIERS[2].multiplier}.`,
  `Extra: +${s.firstJobBonus} en su primer trabajo completado, +${s.reviewBonus} al calificar a su profesional.`,
  `Los puntos nuevos quedan pendientes ${s.pendingDays} días; después están listos para usar. Los trabajos reembolsados no ganan puntos.`,
  `Convierta cada ${s.redeemStep.toLocaleString("en-US")} puntos en un crédito de $${loyaltyDollars(s.redeemStep, s)} para su próxima reserva.`,
  `Los puntos vencen después de ${s.inactivityExpiryMonths} meses sin un trabajo completado. No tienen valor en efectivo.`,
];
