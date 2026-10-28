-- ============================================================================
-- FILE    : supabase/setup/ADD_HUB_CUSTOMER_TOTALS_2026-10-28_1735.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-10-28_1735 UTC
-- PURPOSE : ONE paste for the EXISTING Supabase project: Mastermind → Customers & B2B lists every customer (totals per
--           customer in the database). Same as migration 20261028173500_hub_customer_totals.sql. Safe to run twice.
--           Supabase -> SQL Editor -> New query -> paste this whole file -> Run.
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
