-- ============================================================================
-- FILE    : supabase/migrations/20261002030209_customer_timing_budget.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-02_0302 UTC
-- PURPOSE : Track what customers tell us when they ask for work:
--             jobs.urgency          — asap / this_week / two_weeks / month / flexible
--             jobs.needed_by        — last day they need it done (deadline alerts use it)
--             jobs.customer_budget  — what they want to spend (never changes our price)
--             business_accounts.monthly_budget / start_by — the same for business proposals
-- ============================================================================
alter table public.jobs
  add column if not exists urgency text check (urgency in ('asap','this_week','two_weeks','month','flexible')),
  add column if not exists needed_by date,
  add column if not exists customer_budget numeric(12,2) check (customer_budget is null or customer_budget >= 0);

create index if not exists jobs_needed_by_idx on public.jobs (needed_by) where status not in ('completed','cancelled');

alter table public.business_accounts
  add column if not exists monthly_budget numeric(12,2),
  add column if not exists start_by text check (start_by in ('asap','this_week','two_weeks','month','flexible'));
