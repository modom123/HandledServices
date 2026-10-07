-- ============================================================================
-- FILE    : supabase/migrations/20261006032400_factoring_partners.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-06_0324 UTC
-- PURPOSE : Invoice factoring partners (packages/core/src/factoring.ts, Hub → Factoring): the companies we're asking
--           to fund net-30+ business, city and government invoices so weekly pro payouts stay on time. One row per
--           partner with the outreach status and the quote (advance rate, fee, recourse, minimums, term, fees).
--           Seeded with the five partners from docs/FACTORING_COMPARISON_2026-10-06_0320.xlsx (web search, verify on
--           the call). Staff only. No contract or bank details are stored here.
-- ============================================================================
create table if not exists public.factoring_partners (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  website text,
  fit text,
  sort int not null default 100,
  status text not null default 'to_contact'
    check (status in ('to_contact','emailed','call_scheduled','quote_received','applied','active','passed')),
  gov_scope text,                                   -- which receivables they fund: federal / state / city
  advance_rate numeric check (advance_rate is null or (advance_rate > 0 and advance_rate <= 1)),
  fee_pct numeric check (fee_pct is null or (fee_pct >= 0 and fee_pct < 1)),
  fee_period_days int check (fee_period_days is null or fee_period_days between 1 and 90),
  days_to_fund int check (days_to_fund is null or days_to_fund between 0 and 60),
  recourse text check (recourse is null or recourse in ('recourse','non_recourse')),
  monthly_minimum numeric check (monthly_minimum is null or monthly_minimum >= 0),
  term text,                                        -- contract length / auto-renew / early-exit fee
  spot_factoring boolean,
  other_fees text,
  contact_name text,
  contact_email text,
  contact_phone text,
  contacted_at date,
  notes text,
  updated_by text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.factoring_partners enable row level security;
create policy staff_all on public.factoring_partners for all to authenticated using (public.is_staff()) with check (public.is_staff());

insert into public.factoring_partners (slug, name, website, fit, sort) values
  ('advance-partners', 'Advance Partners', 'https://www.advancepartners.com/payroll-funding/government-staffing/',
   'Payroll funding for staffing on government contracts, including municipal; back office for payroll and billing. Best fit for the weekly pro payout run.', 10),
  ('1st-commercial-credit', '1st Commercial Credit', 'https://www.1stcommercialcredit.com/financial-services/government-receivables',
   'Dedicated government-receivables program plus staffing and payroll funding; works with small businesses.', 20),
  ('porter-capital', 'Porter Capital', 'https://portercap.com/government-invoice-factoring',
   'Long-time government contractor factoring; covers service and staffing businesses.', 30),
  ('ecapital', 'eCapital', 'https://ecapital.com/blog/using-government-contractor-financing-to-bridge-cash-flow-gaps',
   'Large lender with government contractor financing; can grow into an asset-based credit line for bigger contracts.', 40),
  ('8a-factoring', '8A Factoring', 'https://www.8afactoring.com',
   'Government invoices for small and 8(a) / minority-owned businesses; fits set-aside and MBE/DBE work.', 50)
on conflict (slug) do nothing;
