/*
 * FILE    : apps/web/lib/paypal.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_1900 UTC
 * PURPOSE : PayPal Payouts API — how pros who chose PayPal or Venmo get paid (core payout-rails.ts). Money comes from
 *           Handled's PayPal Business balance (keep it funded before Monday; Hub → Money shows it).
 *             paypalConfigured   PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET set (PAYPAL_ENV=sandbox for testing; live default)
 *             sendPaypalPayout   one payout item (PayPal email, or Venmo phone) — sender_batch_id makes it idempotent:
 *                                PayPal refuses a second batch with the same id, so a retry can never pay twice
 *             paypalItem         a payout item's current status (SUCCESS, UNCLAIMED, RETURNED…)
 *             paypalBalance      USD available in the PayPal account (needs the "balances" permission on the app; null if not)
 */
import "server-only";

const base = () => (process.env.PAYPAL_ENV === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com");
export const paypalConfigured = () => Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);

let token: { value: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (token && token.exp > Date.now() + 60_000) return token.value;
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const r = await fetch(`${base()}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials", signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new PaypalError(`PayPal sign-in failed (${r.status}) — check PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / PAYPAL_ENV`, r.status, false);
  const j = (await r.json()) as { access_token: string; expires_in: number };
  token = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return token.value;
}

/** `definite` = PayPal answered and said no (safe to put the pay back as owed); false = unknown outcome (don't retry blind). */
export class PaypalError extends Error {
  status: number;
  definite: boolean;
  code: string | null;
  constructor(message: string, status: number, definite: boolean, code?: string) { super(message); this.status = status; this.definite = definite; this.code = code ?? null; }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${base()}${path}`, { ...init, headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(30_000) });
  } catch (e) {
    if (e instanceof PaypalError) throw e;
    throw new PaypalError(`PayPal didn't answer: ${e instanceof Error ? e.message : String(e)}`, 0, false);
  }
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) {
    const name = String(j.name ?? "");
    const msg = String(j.message ?? `PayPal error ${r.status}`);
    // 4xx = PayPal refused the request (nothing sent); 5xx = their side, outcome unknown
    throw new PaypalError(name === "INSUFFICIENT_FUNDS" ? "Not enough money in the PayPal account — add funds, then Pay now" : `${msg}${name ? ` (${name})` : ""}`, r.status, r.status < 500, name);
  }
  return j as T;
}

export type PaypalPayout = { batchId: string; itemId: string | null; status: string };

/** One payout: PayPal email (wallet PAYPAL) or Venmo phone (wallet VENMO). `senderBatchId` must be unique per payout. */
export async function sendPaypalPayout(o: { rail: "paypal" | "venmo"; handle: string; amount: number; senderBatchId: string; note: string; subject: string }): Promise<PaypalPayout> {
  const item: Record<string, unknown> = {
    recipient_type: o.rail === "venmo" ? "PHONE" : "EMAIL",
    receiver: o.handle,
    amount: { value: o.amount.toFixed(2), currency: "USD" },
    note: o.note.slice(0, 4000),
    sender_item_id: o.senderBatchId.slice(0, 63),
    ...(o.rail === "venmo" ? { recipient_wallet: "VENMO" } : {}),
  };
  const j = await call<{ batch_header: { payout_batch_id: string; batch_status: string } }>("/v1/payments/payouts", {
    method: "POST",
    body: JSON.stringify({ sender_batch_header: { sender_batch_id: o.senderBatchId.slice(0, 127), email_subject: o.subject, email_message: o.note.slice(0, 1000), recipient_type: item.recipient_type }, items: [item] }),
  });
  const batchId = j.batch_header.payout_batch_id;
  // the item id appears once PayPal has split the batch (usually immediately)
  const b = await call<{ items?: { payout_item_id: string; transaction_status: string }[] }>(`/v1/payments/payouts/${batchId}`).catch(() => null);
  const it = b?.items?.[0];
  return { batchId, itemId: it?.payout_item_id ?? null, status: it?.transaction_status ?? j.batch_header.batch_status };
}

/** The current status of a payout (by item id, or the first item of a batch). */
export async function paypalItem(ref: { batchId: string; itemId?: string | null }): Promise<{ itemId: string | null; status: string; error: string | null }> {
  if (ref.itemId) {
    const j = await call<{ payout_item_id: string; transaction_status: string; errors?: { message?: string } }>(`/v1/payments/payouts-item/${ref.itemId}`);
    return { itemId: j.payout_item_id, status: j.transaction_status, error: j.errors?.message ?? null };
  }
  const b = await call<{ items?: { payout_item_id: string; transaction_status: string; errors?: { message?: string } }[] }>(`/v1/payments/payouts/${ref.batchId}`);
  const it = b.items?.[0];
  return { itemId: it?.payout_item_id ?? null, status: it?.transaction_status ?? "PENDING", error: it?.errors?.message ?? null };
}

/** USD available in Handled's PayPal account, or null when the app can't read balances. */
export async function paypalBalance(): Promise<number | null> {
  if (!paypalConfigured()) return null;
  try {
    const j = await call<{ balances?: { currency: string; available_balance?: { value: string } }[] }>("/v1/reporting/balances?currency_code=USD");
    const usd = j.balances?.find((b) => b.currency === "USD");
    return usd?.available_balance ? Number(usd.available_balance.value) : null;
  } catch { return null; }
}
