-- ============================================================================
-- FILE    : supabase/setup/ADD_GOV_SUBCONTRACTING_2026-10-19_2140.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-10-19_2140 UTC
-- PURPOSE : ONE paste for the EXISTING Supabase project — subcontract targets and the landscaping, painting, AI
--           automation, window installation, carpet cleaning and construction focus = migration 20261019214000_gov_subcontracting.sql.
--           Run ADD_GOV_CONTRACT_AWARDS_2026-10-19_2015.sql first (once).
--           Supabase -> SQL Editor -> paste this whole file -> Run. Safe to run twice.
-- ============================================================================

alter table public.gov_awards add column if not exists awardee_phone text;
alter table public.gov_awards add column if not exists awardee_address text;
alter table public.gov_awards add column if not exists awardee_size text;
alter table public.gov_awards add column if not exists subcontract_plan text;
alter table public.gov_awards add column if not exists sub_score int not null default 0;
alter table public.gov_awards add column if not exists sub_fit jsonb;
create index if not exists gov_awards_sub on public.gov_awards (sub_score desc);

alter table public.gov_settings add column if not exists awards_naics text[] not null default array['561730','238320','541511','541512','541519','238150','561740','236220','236118']::text[];
update public.gov_settings set naics = array['561730','238320','541511','541512','541519','238150','561740','236220','236118']::text[]
  where naics = array['561720','561730','561790','561612','562111','484210']::text[];
