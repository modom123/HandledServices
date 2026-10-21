-- ============================================================================
-- FILE    : supabase/setup/ADD_GOV_DAILY_PICKS_2026-10-19_2330.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-10-19_2330 UTC
-- PURPOSE : ONE paste for the EXISTING Supabase project — the AI bid desk picks 5 government bids a day
--           = migration 20261019233000_gov_daily_picks.sql. Run after ADD_GOV_CONTRACT_AWARDS and ADD_GOV_SUBCONTRACTING.
--           Supabase -> SQL Editor -> paste this whole file -> Run. Safe to run twice.
-- ============================================================================

alter table public.gov_settings add column if not exists daily_picks int not null default 5 check (daily_picks between 0 and 20);
alter table public.gov_opportunities add column if not exists picked_at timestamptz;
create index if not exists gov_opportunities_picked on public.gov_opportunities (picked_at);
update public.gov_settings set daily_call_budget = 10 where daily_call_budget = 8;
