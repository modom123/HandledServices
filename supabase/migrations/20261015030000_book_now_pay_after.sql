-- ============================================================================
-- FILE    : supabase/migrations/20261015030000_book_now_pay_after.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-15_0300 UTC
-- PURPOSE : Book now, pay the rest when it's done (packages/core/src/pricing.ts → BOOK_NOW, PAY_IN_FULL).
--             • jobs.payment_plan adds 'after': 25% at booking (deposit_amount / deposit_paid_at); the balance is held
--               on the card when the pro starts (balance_hold_intent, a Stripe authorization) and charged when the job
--               is complete; a failed charge is retried daily (balance_charge_at = next try, balance_attempts)
--             • pay_in_full_discount: the 5% saving for paying in full at booking (taken from our share)
--           Safe to run twice.
-- ============================================================================

alter table public.jobs drop constraint if exists jobs_payment_plan_check;
alter table public.jobs add constraint jobs_payment_plan_check check (payment_plan in ('full','deposit','after'));

alter table public.jobs
  add column if not exists balance_charge_at timestamptz,
  add column if not exists balance_attempts int not null default 0,
  add column if not exists balance_hold_intent text,
  add column if not exists pay_in_full_discount numeric(10,2) not null default 0;

-- the daily sweep looks for balances that are due
create index if not exists jobs_balance_charge_idx on public.jobs (balance_charge_at) where payment_plan = 'after' and paid_at is null;
