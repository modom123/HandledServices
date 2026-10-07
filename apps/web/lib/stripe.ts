/*
 * FILE    : apps/web/lib/stripe.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-01_1900 UTC — Paid upfront, always. Customers pay the full price at
 *           booking (or when a site-visit quote is approved); the card is saved so each
 *           recurring visit is charged before it's dispatched. Refunds go back to the
 *           original payment.
 * UPDATED : 2026-10-01_2053 UTC — createCheckout(): one dynamic Checkout for any amount
 *           (deposits, balances, change orders, Quick Charge links) — no Stripe products.
 * UPDATED : 2026-10-01_2124 UTC — materials pass-through charges, refunds across several
 *           payments (deposit + balance), Stripe Connect for pro instant pay.
 * UPDATED : 2026-10-02_1329 UTC — sales tax: with STRIPE_TAX=on, Checkout adds tax automatically for
 *           services (tax code "General – Services"); tips and gift cards are never taxed.
 * UPDATED : 2026-10-06_0708 UTC — createPaymentSheet(): the app pays in place with Apple Pay, Google Pay or a card
 *           (Stripe PaymentSheet). Same amounts and saved card as Checkout; with STRIPE_TAX=on it hands back the
 *           Checkout link instead, because automatic sales tax runs in Checkout.
 * UPDATED : 2026-10-07_1610 UTC — permanent pay links (/pay/<id> re-opens an expired Checkout); a job's deposit / balance /
 *           full payment reuses its open link instead of making a second one; availableBalance() for payout runs.
 * PURPOSE : Stripe payments.
 */
import "server-only";
import Stripe from "stripe";
import { BRAND, getService, type Job } from "@handled/core";
import { adminClient } from "./supabase/server";
import { siteUrl } from "./notify";

let stripe: Stripe | null = null;
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return (stripe ??= new Stripe(key));
}

const cents = (v: number) => Math.round(v * 100);

export type ChargeKind = "upfront" | "deposit" | "balance" | "change_order" | "offer_raise" | "custom" | "materials" | "tip" | "gift_card" | "invoice";

/** The link we send people: permanent, unlike a Stripe Checkout link (those expire after 24 hours). /pay/<id> opens a fresh one. */
export const payLink = (paymentId: string) => `${siteUrl()}/pay/${paymentId}`;

/** Where Checkout returns after paying, by kind (the same for the first session and any re-opened one). */
export function successPathFor(kind: string, job: { id: string; ref: string } | null) {
  if (kind === "gift_card") return "/gift-cards?sent=1";
  if (kind === "tip" && job) return `/account/jobs/${job.id}?tipped=1`;
  if (job && kind !== "invoice") return `/book/confirmed?ref=${job.ref}&paid=1`;
  return "/pay/thanks";
}

/** Job payments that should never have two live links at once (the old one is reused instead). */
const ONE_LINK_KINDS = ["upfront", "deposit", "balance"];

/**
 * One Stripe Checkout for any amount — no products to set up in Stripe; the line item is
 * built on the fly ("Junk Removal — H-1042"). Records a pending payment row and returns the
 * permanent pay link (/pay/<id>). Returns null when Stripe isn't configured.
 * A job's deposit / balance / full payment reuses its open link for the same amount, so a customer
 * can't end up paying two links for the same thing.
 */
export async function createCheckout(o: {
  amount: number;
  name: string;
  description?: string | null;
  kind: ChargeKind;
  customerEmail: string;
  customerName?: string | null;
  job?: Job | null;
  createdBy?: string | null;
  successPath?: string;
}): Promise<{ url: string; paymentId: string } | null> {
  const s = getStripe();
  if (!s || !(o.amount > 0)) return null;
  const db = adminClient();
  if (o.job && ONE_LINK_KINDS.includes(o.kind)) {
    const { data: open } = await db.from("payments").select("id").eq("job_id", o.job.id).eq("kind", o.kind).eq("status", "pending").eq("amount", o.amount).not("stripe_session_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (open) return { url: payLink(open.id), paymentId: open.id };
  }
  const { data: pay } = await db.from("payments").insert({
    job_id: o.job?.id ?? null, kind: o.kind, amount: o.amount, status: "pending", description: o.description ?? o.name,
    customer_name: o.customerName ?? null, customer_email: o.customerEmail, created_by: o.createdBy ?? null,
  }).select("*").single();
  await openCheckoutSession(pay!, o.job ?? null, { name: o.name, description: o.description ?? null, successPath: o.successPath });
  return { url: payLink(pay!.id), paymentId: pay!.id };
}

type PaymentRow = { id: string; job_id: string | null; kind: string; amount: number; description: string | null; customer_email: string | null; customer_name: string | null };

/** A Stripe Checkout session for a pending payment row (the first one, or a fresh one when the old link expired). */
export async function openCheckoutSession(row: PaymentRow, job: Job | null, o: { name?: string; description?: string | null; successPath?: string } = {}) {
  const s = getStripe();
  if (!s) return null;
  const db = adminClient();
  let customer = job?.stripe_customer_id ?? null;
  if (!customer) {
    customer = (await s.customers.create({ email: row.customer_email ?? undefined, name: row.customer_name ?? undefined, phone: job?.contact_phone ?? undefined, metadata: job ? { job_id: job.id } : {} })).id;
    if (job) await db.from("jobs").update({ stripe_customer_id: customer }).eq("id", job.id);
  }
  const name = o.name ?? row.description ?? `${BRAND.name} payment`;
  const description = o.name ? o.description : null;
  const meta = { payment_id: row.id, kind: row.kind, ...(job ? { job_id: job.id } : {}) };
  const ref = job?.ref ?? row.id.slice(0, 8);
  const taxed = process.env.STRIPE_TAX === "on" && !["tip", "gift_card", "materials"].includes(row.kind);
  const session = await s.checkout.sessions.create({
    mode: "payment",
    customer,
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: cents(Number(row.amount)), ...(taxed ? { tax_behavior: "exclusive" as const } : {}), product_data: { name, ...(description ? { description } : {}), ...(taxed ? { tax_code: "txcd_20030000" } : {}) } } }],
    ...(taxed ? { automatic_tax: { enabled: true }, billing_address_collection: "required" as const, customer_update: { address: "auto" as const, name: "auto" as const } } : {}),
    // save the card so balances, recurring visits and add-ons can be charged later
    payment_intent_data: { setup_future_usage: "off_session", metadata: meta, description: `${BRAND.name} ${ref} — ${name}` },
    metadata: meta,
    success_url: `${siteUrl()}${o.successPath ?? successPathFor(row.kind, job)}`,
    cancel_url: `${siteUrl()}${job ? `/book/confirmed?ref=${job.ref}&unpaid=1` : "/"}`,
    custom_text: { submit: { message: row.kind === "deposit" ? `Deposit to lock in your date. ${BRAND.promise}` : BRAND.promise } },
  });
  await db.from("payments").update({ stripe_session_id: session.id, link_url: payLink(row.id) }).eq("id", row.id);
  return session;
}

/** What the customer owes now on a job under its payment plan. */
export function amountDue(job: Job, kind: "deposit" | "full" | "balance" = "full") {
  const price = Number(job.price_final ?? 0), paid = Number(job.amount_paid ?? 0);
  if (kind === "deposit" && job.deposit_amount && !job.deposit_paid_at) return Number(job.deposit_amount);
  return Math.max(0, Math.round((price - paid) * 100) / 100);
}

/**
 * Checkout for a job: the deposit if the customer chose a deposit plan and hasn't paid it,
 * otherwise everything still owed (full price, or the balance after a deposit).
 */
export async function paymentCheckoutUrl(job: Job): Promise<string | null> {
  const svc = getService(job.service_slug);
  const deposit = job.payment_plan === "deposit" && !job.deposit_paid_at && Number(job.amount_paid ?? 0) === 0;
  const amount = amountDue(job, deposit ? "deposit" : "full");
  if (!amount) return null;
  const kind: ChargeKind = deposit ? "deposit" : Number(job.amount_paid ?? 0) > 0 ? "balance" : "upfront";
  const label = kind === "deposit" ? " — deposit" : kind === "balance" ? " — balance" : "";
  const r = await createCheckout({
    amount, kind, job, name: `${svc?.name ?? "Service"}${label} — ${job.ref}`,
    description: `${job.address}, ${job.city}${kind === "deposit" && job.balance_due_date ? ` · balance due ${job.balance_due_date}` : ""}`,
    customerEmail: job.contact_email, customerName: job.contact_name,
  });
  return r?.url ?? null;
}

/** Publishable key the app needs to show the payment sheet (never a secret). */
export const stripePublishableKey = () => process.env.STRIPE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

export type PaymentSheet =
  | { mode: "sheet"; clientSecret: string; publishableKey: string; amount: number; kind: ChargeKind; merchantName: string }
  | { mode: "checkout"; url: string; amount: number }
  | { mode: "none" };

/**
 * Pay in the app (Apple Pay / Google Pay / card) for what's owed on a job now: the deposit, the
 * balance or the full price, exactly as paymentCheckoutUrl() would charge. The card is saved to the
 * job's Stripe customer for later visits. The webhook (payment_intent.succeeded, source=app) marks it
 * paid the same way Checkout does. Falls back to Checkout when sales tax is on or there's no
 * publishable key.
 */
export async function createPaymentSheet(job: Job): Promise<PaymentSheet> {
  const s = getStripe();
  if (!s) return { mode: "none" };
  const deposit = job.payment_plan === "deposit" && !job.deposit_paid_at && Number(job.amount_paid ?? 0) === 0;
  const amount = amountDue(job, deposit ? "deposit" : "full");
  if (!amount) return { mode: "none" };
  if (process.env.STRIPE_TAX === "on" || !stripePublishableKey()) {
    const url = await paymentCheckoutUrl(job);
    return url ? { mode: "checkout", url, amount } : { mode: "none" };
  }
  const kind: ChargeKind = deposit ? "deposit" : Number(job.amount_paid ?? 0) > 0 ? "balance" : "upfront";
  const svc = getService(job.service_slug);
  const name = `${svc?.name ?? "Service"}${kind === "deposit" ? " — deposit" : kind === "balance" ? " — balance" : ""} — ${job.ref}`;
  const db = adminClient();
  let customer = job.stripe_customer_id ?? null;
  if (!customer) {
    customer = (await s.customers.create({ email: job.contact_email, name: job.contact_name ?? undefined, phone: job.contact_phone ?? undefined, metadata: { job_id: job.id } })).id;
    await db.from("jobs").update({ stripe_customer_id: customer }).eq("id", job.id);
  }
  const { data: pay } = await db.from("payments").insert({
    job_id: job.id, kind, amount, status: "pending", description: name, customer_name: job.contact_name ?? null, customer_email: job.contact_email,
  }).select("id").single();
  const pi = await s.paymentIntents.create({
    amount: cents(amount),
    currency: "usd",
    customer,
    setup_future_usage: "off_session", // balances, recurring visits and add-ons can be charged later
    automatic_payment_methods: { enabled: true },
    description: `${BRAND.name} ${job.ref} — ${name}`,
    metadata: { payment_id: pay!.id, kind, job_id: job.id, source: "app" },
  });
  await db.from("payments").update({ stripe_payment_intent_id: pi.id }).eq("id", pay!.id);
  return { mode: "sheet", clientSecret: pi.client_secret!, publishableKey: stripePublishableKey(), amount, kind, merchantName: BRAND.name };
}

/** Charge the saved card (recurring visits, balances). Returns the amount charged or 0. */
export async function chargeSavedCard(job: Job, amount = Number(job.price_final ?? 0), kind: ChargeKind = "upfront", ref = ""): Promise<number> {
  const s = getStripe();
  if (!s || !job.stripe_customer_id || !job.stripe_payment_method || !(amount > 0)) return 0;
  try {
    const pi = await s.paymentIntents.create({
      amount: cents(amount),
      currency: "usd",
      customer: job.stripe_customer_id,
      payment_method: job.stripe_payment_method,
      off_session: true,
      confirm: true,
      description: `${BRAND.name} ${job.ref} — ${getService(job.service_slug)?.name}${kind === "balance" ? " (balance)" : ""}`,
      metadata: { job_id: job.id, kind },
    }, { idempotencyKey: `job-${job.id}-${kind}-${cents(amount)}${ref ? `-${ref}` : ""}` });
    if (pi.status !== "succeeded") return 0;
    await adminClient().from("payments").insert({ job_id: job.id, kind, amount, status: "paid", paid_at: new Date().toISOString(), stripe_session_id: pi.id, description: ref ? `${kind} ${ref}` : null });
    if (!job.stripe_payment_intent && kind !== "materials") await adminClient().from("jobs").update({ stripe_payment_intent: pi.id }).eq("id", job.id);
    return amount;
  } catch {
    return 0;
  }
}

/** Refund part or all of a job's payment back to the customer's card. */
export async function refundPayment(job: Job, amount: number): Promise<{ ok: boolean; id?: string; error?: string }> {
  const s = getStripe();
  if (!s) { // paid outside Stripe (or the key is missing): recorded, and ops is told to send it by hand
    await (await import("./jobs")).raiseAlert("refund", "critical", `Refund ${job.ref} by hand: $${amount.toFixed(2)}`, "Stripe isn't configured, so no money was sent back automatically.", job.id).catch(() => {});
    return { ok: true };
  }
  if (!job.stripe_payment_intent) return { ok: false, error: "No card payment on this job to refund" };
  try {
    const r = await s.refunds.create({ payment_intent: job.stripe_payment_intent, amount: cents(amount), metadata: { job_id: job.id } }, { idempotencyKey: `job-${job.id}-refund-${cents(job.amount_refunded)}-${cents(amount)}` });
    return { ok: true, id: r.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Refund `amount` across a job's card payments, newest first (a deposit and a balance are two
 * payments). Returns what was refunded; anything Stripe couldn't refund is left for ops.
 */
export async function refundAcross(job: Job, amount: number, reason = "requested_by_customer"): Promise<{ refunded: number; ids: string[]; error?: string }> {
  const s = getStripe();
  if (!s) { // paid outside Stripe (or the key is missing): recorded, and ops is told to send it by hand
    await (await import("./jobs")).raiseAlert("refund", "critical", `Refund ${job.ref} by hand: $${amount.toFixed(2)}`, "Stripe isn't configured, so no money was sent back automatically.", job.id).catch(() => {});
    return { refunded: amount, ids: [] };
  }
  const { data: rows } = await adminClient().from("payments").select("id, amount, stripe_session_id, kind").eq("job_id", job.id).eq("status", "paid").gt("amount", 0).neq("kind", "materials").order("created_at", { ascending: false });
  const intents: { pi: string; amount: number }[] = [];
  for (const r of rows ?? []) {
    const id = String(r.stripe_session_id ?? "");
    let pi = id.startsWith("pi_") ? id : null;
    if (id.startsWith("cs_")) pi = (await s.checkout.sessions.retrieve(id).catch(() => null))?.payment_intent as string | null;
    if (pi) intents.push({ pi, amount: Number(r.amount) });
  }
  if (!intents.length && job.stripe_payment_intent) intents.push({ pi: job.stripe_payment_intent, amount });
  let left = Math.round(amount * 100) / 100;
  const ids: string[] = [];
  let error: string | undefined;
  for (const it of intents) {
    if (left <= 0) break;
    const part = Math.min(left, it.amount);
    try {
      const r = await s.refunds.create({ payment_intent: it.pi, amount: cents(part), metadata: { job_id: job.id, reason } }, { idempotencyKey: `refund-${it.pi}-${cents(part)}-${cents(Number(job.amount_refunded))}` });
      ids.push(r.id);
      left = Math.round((left - part) * 100) / 100;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
  return { refunded: Math.round((amount - left) * 100) / 100, ids, error };
}

/** Money in the platform's Stripe balance that can be sent now, in dollars (card payments take ~2 days to become available). */
export async function availableBalance(): Promise<number | null> {
  const s = getStripe();
  if (!s) return null;
  const b = await s.balance.retrieve().catch(() => null);
  if (!b) return null;
  return (b.available.find((x) => x.currency === "usd")?.amount ?? 0) / 100;
}

/** Stripe Connect (Express) onboarding link so a pro can receive instant payouts. */
export async function connectOnboardingUrl(contractor: { id: string; email: string; business_name: string; stripe_account_id: string | null }): Promise<string | null> {
  const s = getStripe();
  if (!s) return null;
  let acct = contractor.stripe_account_id;
  if (!acct) {
    acct = (await s.accounts.create({
      type: "express", email: contractor.email, business_profile: { name: contractor.business_name },
      capabilities: { transfers: { requested: true } }, metadata: { contractor_id: contractor.id },
    })).id;
    await adminClient().from("contractors").update({ stripe_account_id: acct }).eq("id", contractor.id);
  }
  const link = await s.accountLinks.create({ account: acct, type: "account_onboarding", refresh_url: `${siteUrl()}/pro/earnings?connect=retry`, return_url: `${siteUrl()}/pro/earnings?connect=done` });
  return link.url;
}

/** Is the pro's connected account ready to receive money? */
export async function connectReady(accountId: string | null): Promise<boolean> {
  const s = getStripe();
  if (!s || !accountId) return false;
  const a = await s.accounts.retrieve(accountId).catch(() => null);
  return Boolean(a?.payouts_enabled);
}
