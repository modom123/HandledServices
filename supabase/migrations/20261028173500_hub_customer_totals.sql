-- ============================================================================
-- FILE    : supabase/migrations/20261028173500_hub_customer_totals.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-28_1735 UTC
-- PURPOSE : Mastermind -> Clients -> Customers & B2B: one row per customer (by email) totalled in the database, so the
--           list covers every customer instead of only the newest jobs the page could read.
--             email, name, phone, type (from their latest job), jobs, spend (completed jobs), recurring, last
--           security_invoker: the view runs with the reader's rights (staff only, through the jobs table's RLS).
--           Safe to run twice.
-- ============================================================================
create or replace view public.hub_customer_totals with (security_invoker = true) as
select
  lower(contact_email) as email,
  (array_agg(coalesce(nullif(company_name, ''), contact_name) order by created_at desc))[1] as name,
  (array_agg(contact_phone order by created_at desc))[1] as phone,
  (array_agg(customer_type order by created_at desc))[1] as type,
  count(*)::int as jobs,
  coalesce(sum(price_final) filter (where status = 'completed'), 0)::numeric(12,2) as spend,
  bool_or(frequency <> 'once') as recurring,
  max(created_at) as last
from public.jobs
where contact_email is not null
group by lower(contact_email);

grant select on public.hub_customer_totals to authenticated;
