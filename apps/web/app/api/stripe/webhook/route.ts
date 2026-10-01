/*
 * FILE    : apps/web/app/api/stripe/webhook/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-01_1900 UTC — Upfront payments: checkout.session.completed marks the
 *           job paid (saving the card for recurring visits) and releases it to dispatch.
 * PURPOSE : Stripe webhook.
 */
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { adminClient } from "@/lib/supabase/server";
import { markPaid } from "@/lib/jobs";

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
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const jobId = session.metadata?.job_id;
    if (jobId && session.mode === "payment" && session.payment_status === "paid" && session.payment_intent) {
      const pi = await s.paymentIntents.retrieve(String(session.payment_intent));
      await adminClient().from("payments").update({ status: "paid" }).eq("stripe_session_id", session.id);
      await markPaid(jobId, { amount: (session.amount_total ?? 0) / 100, via: "card", paymentIntent: pi.id, paymentMethod: pi.payment_method ? String(pi.payment_method) : null });
    }
  }
  return Response.json({ received: true });
}
