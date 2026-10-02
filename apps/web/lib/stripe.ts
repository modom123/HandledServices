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

export type ChargeKind = "upfront" | "deposit" | "balance" | "change_order" | "custom" | "materials" | "tip" | "gift_card";

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
  if (!s) return { ok: true }; // paid outside Stripe — ops refunds manually; we still record it
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
  if (!s) return { refunded: amount, ids: [] }; // paid outside Stripe — ops refunds manually
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
