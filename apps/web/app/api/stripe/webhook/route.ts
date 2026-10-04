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
    if (row.kind === "tip") {
      await settleTip(row.id);
    } else if (row.kind === "gift_card") {
      await issueGiftCard(row.id);
    } else if (row.kind === "materials") {
      // pass-through: the customer paid the materials at cost → reimburse the pro
      const { data: exp } = await db.from("job_expenses").select("id").eq("payment_id", row.id).maybeSingle();
      if (exp) await reimburse(exp.id, row.id);
    } else if (row.kind === "invoice" && row.business_invoice_id) {
      await settleInvoice(row.business_invoice_id, amount);
    } else if (row.job_id) {
      await markPaid(row.job_id, { amount, via: "card", kind: row.kind, paymentIntent: pi?.id ?? null, paymentMethod: pi?.payment_method ? String(pi.payment_method) : null });
    } else if (opsEmail()) {
      await sendEmail(opsEmail(), `Paid: $${amount} — ${row.description}`, `${row.customer_name ?? ""} <${row.customer_email}> paid $${amount} for "${row.description}" (Quick Charge by ${row.created_by ?? "staff"}).`);
    }
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
