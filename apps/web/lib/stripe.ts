/*
 * FILE    : apps/web/lib/stripe.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-01_1900 UTC — Paid upfront, always. Customers pay the full price at
 *           booking (or when a site-visit quote is approved); the card is saved so each
 *           recurring visit is charged before it's dispatched. Refunds go back to the
 *           original payment.
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

/**
 * Checkout link for the job's full price. Returns null when Stripe isn't configured
 * (ops then collects payment another way and marks the job paid in the Handled Hub).
 */
export async function paymentCheckoutUrl(job: Job): Promise<string | null> {
  const s = getStripe();
  if (!s || !job.price_final || job.price_final <= 0) return null;
  const db = adminClient();
  let customer = job.stripe_customer_id;
  if (!customer) {
    customer = (await s.customers.create({ email: job.contact_email, name: job.contact_name, phone: job.contact_phone ?? undefined, metadata: { job_id: job.id } })).id;
    await db.from("jobs").update({ stripe_customer_id: customer }).eq("id", job.id);
  }
  const svc = getService(job.service_slug);
  const session = await s.checkout.sessions.create({
    mode: "payment",
    customer,
    line_items: [{
      quantity: 1,
      price_data: { currency: "usd", unit_amount: cents(job.price_final), product_data: { name: `${svc?.name ?? "Service"} — ${job.ref}`, description: `${job.address}, ${job.city}` } },
    }],
    // save the card for recurring visits and add-ons
    payment_intent_data: { setup_future_usage: "off_session", metadata: { job_id: job.id }, description: `${BRAND.name} ${job.ref}` },
    metadata: { job_id: job.id },
    success_url: `${siteUrl()}/book/confirmed?ref=${job.ref}&paid=1`,
    cancel_url: `${siteUrl()}/book/confirmed?ref=${job.ref}&unpaid=1`,
    custom_text: { submit: { message: BRAND.promise } },
  });
  await db.from("payments").insert({ job_id: job.id, kind: "upfront", amount: job.price_final, status: "pending", stripe_session_id: session.id });
  return session.url;
}

/** Charge the saved card for a job (recurring visits). Returns true when paid. */
export async function chargeSavedCard(job: Job): Promise<boolean> {
  const s = getStripe();
  if (!s || !job.stripe_customer_id || !job.stripe_payment_method || !job.price_final) return false;
  try {
    const pi = await s.paymentIntents.create({
      amount: cents(job.price_final),
      currency: "usd",
      customer: job.stripe_customer_id,
      payment_method: job.stripe_payment_method,
      off_session: true,
      confirm: true,
      description: `${BRAND.name} ${job.ref} — ${getService(job.service_slug)?.name}`,
      metadata: { job_id: job.id },
    }, { idempotencyKey: `job-${job.id}-upfront` });
    if (pi.status !== "succeeded") return false;
    await adminClient().from("payments").insert({ job_id: job.id, kind: "upfront", amount: job.price_final, status: "paid", stripe_session_id: pi.id });
    await adminClient().from("jobs").update({ stripe_payment_intent: pi.id }).eq("id", job.id);
    return true;
  } catch {
    return false;
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
