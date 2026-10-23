-- ============================================================================
-- FILE    : supabase/setup/ADD_GROUP_INSURANCE_2026-10-23_2345.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-23_2345 UTC
-- PURPOSE : ONE paste for the existing Supabase project (Supabase -> SQL Editor -> New query -> paste -> Run).
--           Handled group insurance (packages/core/src/group-insurance.ts):
--             • contractors.group_insurance_enrolled_at / _version / _ip — the pro's signed enrollment authorization
--               (the group policy and the monthly payout deduction)
--             • payouts.kind 'insurance' — the monthly fee, a deduction row (status 'clawback') taken from a payout,
--               never more than half of one and never from tips; insurance_month makes it once per pro per month
--             • contractor_1099 — the group insurance fee is a charge the pro pays us, not less pay: it's left out
--               of the 1099 total (other clawbacks, like workmanship refunds, still reduce it)
--           Safe to run twice.
-- ============================================================================
alter table public.contractors
  add column if not exists group_insurance_enrolled_at timestamptz,
  add column if not exists group_insurance_version text,
  add column if not exists group_insurance_ip text;

alter table public.payouts drop constraint if exists payouts_kind_check;
alter table public.payouts add constraint payouts_kind_check
  check (kind in ('job','show_up','guarantee','stipend','materials','clawback','referral','tip','placement','insurance'));
alter table public.payouts add column if not exists insurance_month text;
create unique index if not exists payouts_insurance_once on public.payouts (contractor_id, insurance_month) where kind = 'insurance';

create or replace view public.contractor_1099 with (security_invoker = true) as
select
  c.id as contractor_id,
  c.business_name,
  c.legal_name,
  c.entity_type,
  c.tin_last4,
  c.address_line, c.city, c.state, c.zip,
  c.w9_received_at,
  extract(year from coalesce(p.paid_at, p.created_at))::int as tax_year,
  sum(p.amount) filter (where p.status in ('paid','clawback') and p.kind <> 'insurance') as paid_total,
  sum(p.amount) filter (where p.status in ('approved','pending','held')) as owed_total,
  count(*) filter (where p.status = 'paid') as payments
from public.contractors c
join public.payouts p on p.contractor_id = c.id
group by c.id, tax_year;
