-- ============================================================================
-- FILE    : supabase/migrations/20261006070800_app_payments.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-06_0708 UTC
-- PURPOSE : In-app payments (Apple Pay, Google Pay, card via Stripe PaymentSheet): a payment row
--           remembers its PaymentIntent, so the webhook can settle it and support can look it up.
-- ============================================================================
alter table public.payments add column if not exists stripe_payment_intent_id text;
create index if not exists payments_stripe_payment_intent_idx on public.payments (stripe_payment_intent_id) where stripe_payment_intent_id is not null;
