-- ============================================================================
-- FILE    : supabase/migrations/20261019214000_gov_subcontracting.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-19_2140 UTC
-- PURPOSE : Subcontracting under federal primes (Hub → Gov contracts → Awards & recompetes → Subcontract targets).
--             • gov_awards    — the prime's size (contracting officer's call: S small / O other than small), its
--                               small-business subcontracting plan, phone and address; the subcontract fit score
--             • gov_settings  — awards_naics: the codes the awards search uses (default: our focus — landscaping
--                               561730, painting 238320, AI automation 541511 / 541512 / 541519, window installation
--                               238150, carpet cleaning 561740, construction 236220 / 236118); the opportunities
--                               search moves to the same focus if it was still on the original defaults
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
