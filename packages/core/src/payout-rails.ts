/*
 * FILE    : packages/core/src/payout-rails.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_1900 UTC
 * PURPOSE : How a pro chooses to be paid (owner, 2026-11-17): direct deposit through Stripe (free, the default), PayPal
 *           or Venmo (both sent automatically through the PayPal Payouts API, from Handled's PayPal Business balance;
 *           flat $1.50 per payout, kept by Handled). Cash App and Zelle are not offered (no business API).
 *             PAYOUT_RAILS / railOf      — the methods, their labels and fees
 *             railFee                    — what Handled keeps from a payout on that method
 *             cleanPayoutHandle          — the PayPal email / Venmo phone, checked and normalized (or an error)
 *             paypalItemOutcome          — what a PayPal payout item status means for us (paid, waiting, failed…)
 *           Payouts are recorded gross (the 1099 amount); the fee is stored next to them (payouts.rail_fee).
 */

export type PayoutRail = "stripe" | "paypal" | "venmo";

export const PAYOUT_RAILS: Record<PayoutRail, { label: string; labelEs: string; fee: number; handle: null | "email" | "phone"; arrives: string; arrivesEs: string }> = {
  stripe: { label: "Direct deposit to your bank account", labelEs: "Depósito directo a su cuenta bancaria", fee: 0, handle: null, arrives: "Free · in your bank about 2 business days after Monday", arrivesEs: "Gratis · en su banco unos 2 días hábiles después del lunes" },
  paypal: { label: "PayPal", labelEs: "PayPal", fee: 1.5, handle: "email", arrives: "$1.50 per payout · usually within minutes on Monday", arrivesEs: "$1.50 por pago · normalmente en minutos el lunes" },
  venmo: { label: "Venmo", labelEs: "Venmo", fee: 1.5, handle: "phone", arrives: "$1.50 per payout · usually within minutes on Monday", arrivesEs: "$1.50 por pago · normalmente en minutos el lunes" },
};

/** The rail a pro is paid on, from contractors.payout_method (anything else — null, old ach / check — is Stripe). */
export function railOf(payoutMethod: string | null | undefined): PayoutRail {
  return payoutMethod === "paypal" || payoutMethod === "venmo" ? payoutMethod : "stripe";
}

/** Handled's fee on one payout of `amount` on this rail (never more than the payout). */
export function railFee(rail: PayoutRail, amount: number): number {
  const fee = PAYOUT_RAILS[rail].fee;
  return amount > 0 ? Math.min(fee, Math.round(amount * 100) / 100) : 0;
}

/** A payout on a fee rail must be worth more than its fee; smaller balances wait for the next run. */
export const minPayout = (rail: PayoutRail) => (PAYOUT_RAILS[rail].fee ? PAYOUT_RAILS[rail].fee + 1 : 0.01);

const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/** PayPal: an email. Venmo: a US mobile number (the Payouts API sends Venmo by phone) → "+1XXXXXXXXXX". */
export function cleanPayoutHandle(rail: PayoutRail, raw: string | null | undefined): { ok: true; handle: string | null } | { ok: false; error: string } {
  if (rail === "stripe") return { ok: true, handle: null };
  const v = String(raw ?? "").trim();
  if (rail === "paypal") {
    return EMAIL.test(v) && v.length <= 254 ? { ok: true, handle: v.toLowerCase() } : { ok: false, error: "Enter the email address on your PayPal account" };
  }
  const d = v.replace(/\D/g, "");
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  return ten.length === 10 && !/^[01]/.test(ten) ? { ok: true, handle: `+1${ten}` } : { ok: false, error: "Enter the US mobile number on your Venmo account (10 digits)" };
}

/** Show a handle without exposing all of it: "ma•••@gmail.com", "•••-•••-1234". */
export function maskHandle(handle: string | null | undefined): string {
  if (!handle) return "";
  if (handle.includes("@")) { const [u, d] = handle.split("@"); return `${u.slice(0, 2)}•••@${d}`; }
  return `•••-•••-${handle.slice(-4)}`;
}

/**
 * PayPal payout item statuses → what we do.
 *   paid      SUCCESS — money is in their PayPal / Venmo
 *   waiting   PENDING / ONHOLD / NEW — still processing; check again later
 *   unclaimed UNCLAIMED — no PayPal / Venmo account on that email / phone yet; PayPal holds it 30 days, then returns it
 *   failed    FAILED / RETURNED / REFUNDED / BLOCKED / DENIED / REVERSED — not received: put the pay back as owed
 */
export function paypalItemOutcome(status: string | null | undefined): "paid" | "waiting" | "unclaimed" | "failed" {
  const s = String(status ?? "").toUpperCase();
  if (s === "SUCCESS") return "paid";
  if (s === "UNCLAIMED") return "unclaimed";
  if (["FAILED", "RETURNED", "REFUNDED", "BLOCKED", "DENIED", "REVERSED"].includes(s)) return "failed";
  return "waiting";
}
