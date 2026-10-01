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

export type ChargeKind = "upfront" | "deposit" | "balance" | "change_order" | "custom";

/**
 * One Stripe Checkout for any amount — no products to set up in Stripe; the line item is
 * built on the fly ("Junk Removal — H-1042"). Records a pending payment row and returns the
 * hosted payment link. Returns null when Stripe isn't configured.
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
  let customer = o.job?.stripe_customer_id ?? null;
  if (!customer) {
    customer = (await s.customers.create({ email: o.customerEmail, name: o.customerName ?? undefined, phone: o.job?.contact_phone ?? undefined, metadata: o.job ? { job_id: o.job.id } : {} })).id;
    if (o.job) await db.from("jobs").update({ stripe_customer_id: customer }).eq("id", o.job.id);
  }
  const { data: pay } = await db.from("payments").insert({
    job_id: o.job?.id ?? null, kind: o.kind, amount: o.amount, status: "pending", description: o.description ?? o.name,
    customer_name: o.customerName ?? null, customer_email: o.customerEmail, created_by: o.createdBy ?? null,
  }).select("id").single();
  const meta = { payment_id: pay!.id, kind: o.kind, ...(o.job ? { job_id: o.job.id } : {}) };
  const ref = o.job?.ref ?? pay!.id.slice(0, 8);
  const session = await s.checkout.sessions.create({
    mode: "payment",
    customer,
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: cents(o.amount), product_data: { name: o.name, ...(o.description ? { description: o.description } : {}) } } }],
    // save the card so balances, recurring visits and add-ons can be charged later
    payment_intent_data: { setup_future_usage: "off_session", metadata: meta, description: `${BRAND.name} ${ref} — ${o.name}` },
    metadata: meta,
    success_url: `${siteUrl()}${o.successPath ?? (o.job ? `/book/confirmed?ref=${o.job.ref}&paid=1` : "/pay/thanks")}`,
    cancel_url: `${siteUrl()}${o.job ? `/book/confirmed?ref=${o.job.ref}&unpaid=1` : "/"}`,
    custom_text: { submit: { message: o.kind === "deposit" ? `Deposit to lock in your date. ${BRAND.promise}` : BRAND.promise } },
  });
  await db.from("payments").update({ stripe_session_id: session.id, link_url: session.url }).eq("id", pay!.id);
  return { url: session.url!, paymentId: pay!.id };
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

/** Charge the saved card (recurring visits, balances). Returns the amount charged or 0. */
export async function chargeSavedCard(job: Job, amount = Number(job.price_final ?? 0), kind: ChargeKind = "upfront"): Promise<number> {
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
    }, { idempotencyKey: `job-${job.id}-${kind}-${cents(amount)}` });
    if (pi.status !== "succeeded") return 0;
    await adminClient().from("payments").insert({ job_id: job.id, kind, amount, status: "paid", paid_at: new Date().toISOString(), stripe_session_id: pi.id });
    if (!job.stripe_payment_intent) await adminClient().from("jobs").update({ stripe_payment_intent: pi.id }).eq("id", job.id);
    return amount;
  } catch {
    return 0;
  }
}

/** Refund part or all of a job's payment back to the customer's card. */
export async function refundPayment(job: Job, amount: number): Promise<{ ok: boolean; id?: string; error?: string }> {
  const s = getStripe();
  if (!s) return { ok: true }; // paid outside Stripe — ops refunds manually; we still record it
  if (!job.stripe_payment_intent) return { ok: false, error: "No card payment on this job to refund" };
  try {
    const r = await s.refunds.create({ payment_intent: job.stripe_payment_intent, amount: cents(amount), metadata: { job_id: job.id } }, { idempotencyKey: `job-${job.id}-refund-${cents(job.amount_refunded)}-${cents(amount)}` });
    return { ok: true, id: r.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
