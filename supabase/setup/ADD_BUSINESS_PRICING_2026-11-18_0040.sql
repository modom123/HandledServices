-- ============================================================================
-- FILE    : supabase/setup/ADD_BUSINESS_PRICING_2026-11-18_0040.sql
-- HOW     : Supabase → SQL Editor → paste all of this → Run. (Same as migration 20261118004000_business_pricing.sql.)
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-11-18_0040 UTC
-- PURPOSE : Business pricing (core BUSINESS_PRICING): business orders keep up to 50% for Handled, and the pro is paid
--           the same dollars the job pays at home prices.
--             jobs.business_pricing — this job is priced at business prices (repricing keeps the pro's home-price pay)
--             jobs_take_rate_band   — home jobs: pro paid 60–85% of the list price (unchanged); business-priced jobs:
--                                     50–85%. Every other rule is the same as 20261009030000_handled_uplift.
--           Safe to run twice.
-- ============================================================================
alter table public.jobs add column if not exists business_pricing boolean not null default false;
alter table public.jobs drop constraint if exists jobs_take_rate_band;
alter table public.jobs add constraint jobs_take_rate_band check (
  contractor_payout is null or price_final is null or price_final = 0 or remedy is not null
  or amount_refunded > 0
  or (contractor_payout <= (price_final + coalesce(discount, 0) + coalesce(member_benefit, 0)) * 0.85
      and contractor_payout >= floor((price_final + coalesce(discount, 0) + coalesce(member_benefit, 0)) * (case when business_pricing then 0.50 else 0.60 end)) - 1)
) not valid;
