/*
 * FILE    : packages/core/src/stripe-setup.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-12_0138 UTC
 * PURPOSE : What the Stripe account must be set up with, checked live by Hub → Setup (apps/web/lib/readiness.ts):
 *             STRIPE_WEBHOOK_EVENTS — every event /api/stripe/webhook acts on, and what breaks without it
 *             missingWebhookEvents  — which of them an endpoint isn't subscribed to ("*" covers all)
 *             keyMode / keysMatch   — live vs test keys (a live secret key with a test publishable key fails at checkout)
 */

/** Events the webhook handles → what stops working without it. */
export const STRIPE_WEBHOOK_EVENTS: Record<string, string> = {
  "checkout.session.completed": "paid bookings and pay links are never marked paid or dispatched",
  "checkout.session.async_payment_succeeded": "bank (ACH) payments are never marked paid",
  "checkout.session.async_payment_failed": "failed bank payments aren't flagged",
  "payment_intent.succeeded": "payments made in the mobile app (Apple Pay / Google Pay) aren't marked paid",
  "charge.refunded": "refunds made in the Stripe dashboard aren't recorded on the job",
  "charge.dispute.created": "chargebacks don't hold the pro payout or alert you",
  "charge.dispute.updated": "chargeback status changes are missed",
  "charge.dispute.closed": "won chargebacks don't release the pro payout",
  "customer.subscription.created": "Handled Plus sign-ups aren't recorded",
  "customer.subscription.updated": "Handled Plus changes aren't recorded",
  "customer.subscription.deleted": "Handled Plus cancellations aren't recorded",
  "identity.verification_session.verified": "pro photo ID checks never complete",
  "identity.verification_session.requires_input": "failed pro photo ID checks aren't sent back to the pro",
};

/** Required events an endpoint is missing (none when it listens to "*"). */
export function missingWebhookEvents(enabled: string[] | null | undefined): string[] {
  const on = new Set(enabled ?? []);
  if (on.has("*")) return [];
  return Object.keys(STRIPE_WEBHOOK_EVENTS).filter((e) => !on.has(e));
}

/** "live" / "test" from a Stripe key prefix (sk_, rk_, pk_); null when it isn't a Stripe key. */
export function keyMode(key: string | null | undefined): "live" | "test" | null {
  const m = (key ?? "").match(/^(?:sk|rk|pk)_(live|test)_/);
  return m ? (m[1] as "live" | "test") : null;
}

/** Secret and publishable keys from the same mode (true when the publishable key isn't set). */
export function keysMatch(secret: string | null | undefined, publishable: string | null | undefined): boolean {
  return !publishable || keyMode(secret) === keyMode(publishable);
}
