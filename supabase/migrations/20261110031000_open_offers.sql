-- ============================================================================
-- FILE    : supabase/migrations/20261110031000_open_offers.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-11-10_0310 UTC
-- PURPOSE : Name your price, low offers. An offer below our usual minimum (down to 30% of the suggested price) is still
--           taken: the job is paid as usual, goes straight to the open job board at the customer's price, and stays
--           there until open_offer_until (30 days). If no pro takes it by then, the daily sweep cancels it with a full
--           refund (lib/jobs.ts expireOpenOffers). Rules: packages/core/src/pricing.ts OFFER_BOUNDS.
--             jobs.open_offer_until - set only for these jobs; null for every other job.
--           Safe to run twice. (If the need-to-know access SQL has already been run, the new column is granted to
--           signed-in staff at the end so the Hub can read it.)
-- ============================================================================
alter table public.jobs add column if not exists open_offer_until timestamptz;
create index if not exists jobs_open_offer_idx on public.jobs (open_offer_until) where open_offer_until is not null;
do $$ begin
  -- need-to-know access grants jobs columns one by one: add this one (it is not a money column)
  if exists (select 1 from information_schema.column_privileges where table_schema = 'public' and table_name = 'jobs' and grantee = 'authenticated' and privilege_type = 'SELECT') then
    execute 'grant select (open_offer_until) on public.jobs to authenticated';
  end if;
end $$;
