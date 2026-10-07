/*
 * FILE    : apps/web/app/api/stripe/webhook/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-01_2053 UTC — Any Checkout we create (full, deposit, balance, change
 *           order, Quick Charge) is settled here exactly once: the pending payment row is
 *           flipped to paid atomically, then the amount is applied to its job (if any).
 * UPDATED : 2026-10-02_0316 UTC — chargebacks (charge.dispute.*): the job's unpaid payout is held, ops
 *           get a critical alert with the evidence we have and the deadline; won → payout released.
 *           Tips, gift cards and Handled Plus subscriptions are settled here too (lib/growth).
 * PURPOSE : Stripe webhook.
 * UPDATED : 2026-10-04_1934 UTC — pro photo ID results (identity.verification_session.*).
 * UPDATED : 2026-10-04_1934 UTC — business invoices: paid → invoice and its jobs marked paid (lib/business settleInvoice).
 * UPDATED : 2026-10-05_2034 UTC — Handled Talent invoices (placements, retainer payments) → paid, recruiter share released.
 * UPDATED : 2026-10-06_0708 UTC — payment_intent.succeeded from the app's payment sheet (metadata source=app) settles the payment
 *           the same way as Checkout (shared settle()). Add this event to the Stripe webhook.
 * UPDATED : 2026-10-06_2230 UTC — Xero: a paid Checkout records its payment intent and the sales tax Stripe Tax added
 * UPDATED : 2026-10-07_1545 UTC — a failure while applying a payment raises a critical Hub alert instead of being lost (the row is already paid, so Stripe retries were skipped as duplicates).
 *           (payments.stripe_payment_intent_id, tax_amount), so the daily Xero sync books tax as a liability, not revenue.
 */
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { settleInvoice } from "@/lib/business";
import { adminClient } from "@/lib/supabase/server";
import { markPaid, raiseAlert } from "@/lib/jobs";
import { reimburse } from "@/lib/pro-benefits";
import { opsEmail, sendEmail } from "@/lib/notify";
import { handleDispute } from "@/lib/disputes";
import { issueGiftCard, settleTip, syncSubscription } from "@/lib/growth";

export async function POST(req: Request) {
  const s = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !secret) return new Response("Stripe not configured", { status: 501 });
  let event: Stripe.Event;
  try {
    event = s.webhooks.constructEvent(await req.text(), req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return new Response("Bad signature", { status: 400 });
  }
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object;
    if (session.mode === "subscription" && session.subscription) {
      await syncSubscription(await s.subscriptions.retrieve(String(session.subscription)), session.metadata?.membership_id);
      return Response.json({ received: true });
    }
    if (session.mode !== "payment" || session.payment_status !== "paid") return Response.json({ received: true }); // ACH settles later → async_payment_succeeded
    const db = adminClient();
    const paymentId = session.metadata?.payment_id;
    // idempotent: only the first delivery flips pending → paid and applies the money
    const { data: row } = paymentId
      ? await db.from("payments").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", paymentId).eq("status", "pending").select("*").maybeSingle()
      : { data: null };
    if (!row) return Response.json({ received: true, duplicate: true });
    const pi = session.payment_intent ? await s.paymentIntents.retrieve(String(session.payment_intent)) : null;
    // sales tax (Stripe Tax) is collected on top and remitted — it never counts toward the job
    const amount = (session.amount_subtotal ?? session.amount_total ?? 0) / 100;
    // for the Xero sync: which payment intent paid it, and how much of it was sales tax (separate update — older databases may lack tax_amount)
    await db.from("payments").update({ stripe_payment_intent_id: pi?.id ?? null, tax_amount: (session.total_details?.amount_tax ?? 0) / 100 }).eq("id", row.id);
    await safeSettle(row, amount, pi);
  }
  // in-app payment sheet (Apple Pay / Google Pay / card): settled exactly like a Checkout payment
  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const paymentId = pi.metadata?.source === "app" ? pi.metadata.payment_id : null; // Checkout's own intents are settled above
    if (!paymentId) return Response.json({ received: true });
    const { data: row } = await adminClient().from("payments").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", paymentId).eq("status", "pending").select("*").maybeSingle();
    if (!row) return Response.json({ received: true, duplicate: true });
    await safeSettle(row, (pi.amount_received || pi.amount) / 100, pi);
  }
  if (event.type === "charge.dispute.created" || event.type === "charge.dispute.closed" || event.type === "charge.dispute.updated") {
    await handleDispute(event.data.object as Stripe.Dispute, event.type);
  }
  if (event.type.startsWith("customer.subscription.")) await syncSubscription(event.data.object as Stripe.Subscription);
  // pro photo ID check (Stripe Identity)
  if (event.type === "identity.verification_session.verified" || event.type === "identity.verification_session.requires_input") {
    const vs = event.data.object as Stripe.Identity.VerificationSession;
    const pro = vs.metadata?.contractor_id;
    if (pro) {
      const { idVerified, idNeedsRetry } = await import("@/lib/identity");
      if (event.type === "identity.verification_session.verified") await idVerified(pro, "stripe_identity", vs.id);
      else await idNeedsRetry(pro, vs.last_error?.reason ?? vs.last_error?.code ?? null);
    }
  }
  if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object;
    if (session.metadata?.payment_id) await adminClient().from("payments").update({ status: "failed" }).eq("id", session.metadata.payment_id);
    if (session.metadata?.job_id) await raiseAlert("payment", "warn", "Bank payment failed", `Checkout ${session.id} — the customer's bank transfer didn't go through.`, session.metadata.job_id);
  }
  return Response.json({ received: true });
}

/**
 * The payment row is already marked paid (that's what stops duplicate deliveries), so a failure here would otherwise be
 * silent: Stripe's retry sees "duplicate". Instead ops gets a critical alert to finish it by hand.
 */
async function safeSettle(row: Record<string, any>, amount: number, pi: Stripe.PaymentIntent | null) { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    await settle(row, amount, pi);
  } catch (e) {
    console.error("[stripe webhook] settle failed", e);
    await raiseAlert("payment", "critical", "Payment received but not applied", `Payment ${row.id} (${row.kind ?? "job"}, $${amount}) was charged but applying it failed: ${e instanceof Error ? e.message : String(e)}. Check the job / gift card / tip and finish it by hand.`, row.job_id ?? null).catch(() => {});
  }
}

/** Apply a paid payment: tip, gift card, materials, talent or business invoice, or the job itself. */
async function settle(row: Record<string, any>, amount: number, pi: Stripe.PaymentIntent | null) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const db = adminClient();
  if (row.kind === "tip") {
    await settleTip(row.id);
  } else if (row.kind === "gift_card") {
    await issueGiftCard(row.id);
  } else if (row.kind === "materials") {
    // pass-through: the customer paid the materials at cost → reimburse the pro
    const { data: exp } = await db.from("job_expenses").select("id").eq("payment_id", row.id).maybeSingle();
    if (exp) await reimburse(exp.id, row.id);
  } else if (row.kind === "invoice" && (row.talent_placement_id || row.talent_retainer_id)) {
    await (await import("@/lib/talent")).settleTalentPayment(row, amount);
  } else if (row.kind === "invoice" && row.business_invoice_id) {
    await settleInvoice(row.business_invoice_id, amount);
  } else if (row.job_id) {
    await markPaid(row.job_id, { amount, via: "card", kind: row.kind, paymentIntent: pi?.id ?? null, paymentMethod: pi?.payment_method ? String(pi.payment_method) : null });
  } else if (opsEmail()) {
    await sendEmail(opsEmail(), `Paid: $${amount} — ${row.description}`, `${row.customer_name ?? ""} <${row.customer_email}> paid $${amount} for "${row.description}" (Quick Charge by ${row.created_by ?? "staff"}).`);
  }
}
