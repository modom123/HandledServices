-- ============================================================================
-- FILE    : supabase/migrations/20261001205300_deposits_quick_charge.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-01_2053 UTC
-- PURPOSE : Deposits and Quick Charge payment links.
--             • jobs.payment_plan 'full' | 'deposit'; deposit amount, when it was paid, and
--               when the balance is due. A deposit books the date and the pro; the job can't
--               start and the pro isn't paid out until it's paid in full (jobs.paid_at).
--             • payments can exist without a job (a Quick Charge for anything), carry a
--               description, the customer, the Stripe link and who created it.
-- ============================================================================

alter table public.jobs
  add column payment_plan text not null default 'full' check (payment_plan in ('full','deposit')),
  add column deposit_amount numeric(10,2),
  add column deposit_paid_at timestamptz,
  add column balance_due_date date;

alter table public.payments alter column job_id drop not null;
alter table public.payments
  add column description text,
  add column customer_name text,
  add column customer_email text,
  add column link_url text,
  add column created_by text,
  add column paid_at timestamptz;

alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check
  check (kind in ('deposit','final','milestone','plan','upfront','refund','balance','change_order','custom'));
