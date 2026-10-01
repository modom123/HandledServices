/*
 * FILE    : apps/web/app/api/stripe/webhook/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Stripe webhook: stores the saved payment method when Checkout (setup mode) completes.
 */
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { adminClient } from "@/lib/supabase/server";
import { addEvent } from "@/lib/jobs";

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
    if (jobId && session.setup_intent) {
      const si = await s.setupIntents.retrieve(String(session.setup_intent));
      await adminClient().from("jobs").update({ stripe_payment_method: String(si.payment_method) }).eq("id", jobId);
      await addEvent(jobId, "card_saved", "Card saved — you'll be charged only after the job is complete.");
    }
  }
  return Response.json({ received: true });
}
