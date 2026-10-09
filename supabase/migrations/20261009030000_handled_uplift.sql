-- ============================================================================
-- FILE    : supabase/migrations/20261009030000_handled_uplift.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-09_0300 UTC
-- PURPOSE : Handled keeps 5 more points of every price, paid by customers (pro pay in dollars is unchanged).
--           Handled's share can now reach 40% (was 35%), so the guards move: a pro's payout may be as low as 60% of
--           the list price (was 65%); the services catalog's reporting share band becomes 0.60-0.85.
-- ============================================================================
alter table public.jobs drop constraint if exists jobs_take_rate_band;
alter table public.jobs add constraint jobs_take_rate_band check (
  contractor_payout is null or price_final is null or price_final = 0 or remedy is not null
  or amount_refunded > 0
  or (contractor_payout <= (price_final + coalesce(discount, 0) + coalesce(member_benefit, 0)) * 0.85
      and contractor_payout >= floor((price_final + coalesce(discount, 0) + coalesce(member_benefit, 0)) * 0.60) - 1)
) not valid;

alter table public.services drop constraint if exists services_payout_share_band;
alter table public.services add constraint services_payout_share_band check (payout_share between 0.60 and 0.85);
