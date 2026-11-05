-- ============================================================================
-- FILE    : supabase/setup/FIX_PAYOUT_SHARE_BANDS_2026-11-05_1222.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-11-05_1222 UTC
-- PURPOSE : ONE paste: the Oct 9 pricing update's database rules (migration 20261009030000_handled_uplift), which
--           this project never got. Fixes Go-live setup's "Service catalog ... services_payout_share_band" error AND
--           lets job payouts go down to 60% of the price (the pricing code's floor; the old rule stopped at 65%,
--           so a job priced at the new Handled share could fail to save its payout). Safe to run twice.
--           Supabase -> SQL Editor -> New query -> paste this whole file -> Run. Then Go-live setup -> Sync service catalog.
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

notify pgrst, 'reload schema';
