-- ============================================================================
-- FILE    : supabase/migrations/20261117190000_payout_paypal_venmo.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-11-17_1900 UTC
-- PURPOSE : Pros choose how they're paid: direct deposit to their bank (Stripe, free), PayPal or Venmo (PayPal Payouts
--           API, $1.50 per payout kept by Handled). Rules: packages/core/src/payout-rails.ts.
--             contractors.payout_method  + 'paypal', 'venmo'
--             contractors.payout_handle  PayPal email / Venmo phone (+1...)
--             payouts.rail               'stripe' | 'paypal' | 'venmo' (how that payout was sent)
--             payouts.rail_fee           Handled's fee on that payout (rows stay gross = the 1099 amount)
--             payouts.rail_ref           PayPal payout batch id / item id
--             payouts.rail_status        PayPal item status (SUCCESS, UNCLAIMED, RETURNED...)
--           Server-only columns (money is admin-read). Safe to run twice.
-- ============================================================================
alter table public.contractors drop constraint if exists contractors_payout_method_check;
alter table public.contractors add constraint contractors_payout_method_check
  check (payout_method is null or payout_method in ('ach','stripe_connect','check','paypal','venmo'));
alter table public.contractors add column if not exists payout_handle text;

alter table public.payouts add column if not exists rail text check (rail is null or rail in ('stripe','paypal','venmo'));
alter table public.payouts add column if not exists rail_fee numeric(10,2) not null default 0 check (rail_fee >= 0);
alter table public.payouts add column if not exists rail_ref text;
alter table public.payouts add column if not exists rail_status text;
create index if not exists payouts_rail_pending_idx on public.payouts (rail, rail_status) where rail in ('paypal','venmo');
