/*
 * FILE    : apps/web/lib/stripe.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Payments. Customers save a card at booking (Stripe Checkout, setup mode) and are charged automatically only after the job passes QA — the same moment the pro's payout is approved.
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

/** Returns a Checkout URL that saves the customer's card, or null when Stripe is off. */
export async function stripeCheckoutUrl(job: Job): Promise<string | null> {
  const s = getStripe();
  if (!s) return null;
  const customer = await s.customers.create({ email: job.contact_email, name: job.contact_name, phone: job.contact_phone ?? undefined, metadata: { job_id: job.id } });
  const session = await s.checkout.sessions.create({
    mode: "setup",
    customer: customer.id,
    currency: "usd",
    success_url: `${siteUrl()}/book/confirmed?ref=${job.ref}&card=1`,
    cancel_url: `${siteUrl()}/book/confirmed?ref=${job.ref}`,
    metadata: { job_id: job.id },
    custom_text: { submit: { message: `${BRAND.name} charges this card only after your ${getService(job.service_slug)?.name ?? "job"} is complete and checked.` } },
  });
  await adminClient().from("jobs").update({ stripe_customer_id: customer.id }).eq("id", job.id);
  return session.url;
}

/** Charge the saved card once a job is completed. */
export async function chargeCompletedJob(job: Job) {
  const s = getStripe();
  if (!s || !job.stripe_customer_id || !job.stripe_payment_method || !job.price_final) return null;
  const db = adminClient();
  try {
    const pi = await s.paymentIntents.create({
      amount: Math.round(Number(job.price_final) * 100),
      currency: "usd",
      customer: job.stripe_customer_id,
      payment_method: job.stripe_payment_method,
      off_session: true,
      confirm: true,
      description: `${BRAND.name} ${job.ref} — ${getService(job.service_slug)?.name}`,
      metadata: { job_id: job.id },
    }, { idempotencyKey: `job-${job.id}-final` });
    await db.from("payments").insert({ job_id: job.id, kind: "final", amount: job.price_final, status: pi.status === "succeeded" ? "paid" : "pending", stripe_session_id: pi.id });
    return pi.status;
  } catch (e) {
    await db.from("payments").insert({ job_id: job.id, kind: "final", amount: job.price_final, status: "failed" });
    await db.from("ops_alerts").insert({ kind: "payment", severity: "critical", title: `${job.ref}: card charge failed`, body: String(e), job_id: job.id });
    return "failed";
  }
}
