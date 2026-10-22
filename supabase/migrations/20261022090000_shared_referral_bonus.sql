-- ============================================================================
-- FILE    : supabase/migrations/20261022090000_shared_referral_bonus.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-22_0900 UTC
-- PURPOSE : The referral bonus is SHARED: half from Handled's take, half from the pro who does the job
--           (packages/core/src/partners.ts REFERRAL_COST_SPLIT). The bonus itself is unchanged (10% / 15% / 20% of
--           Handled's take, worked out on the pro's full pay). The pro's half is a separate line on their payout
--           statement ("Your half of the referral bonus - JOB-REF"), netted in the weekly payout, and it follows refunds
--           down. It applies to jobs accepted from 2026-11-22 (30 days' notice) under contractor agreement v10+;
--           before that, or with no pro on the job, Handled carries the whole bonus.
--             jobs.referral_pct                       - the referral rate on a credited job (shown on the offer / work order)
--             partner_commissions.pro_share / handled_share / contractor_id / pro_share_payout_id
--             payouts.kind 'referral_share'           - the pro's half (negative, netted like a clawback)
--           Safe to run twice.
-- ============================================================================
alter table public.jobs add column if not exists referral_pct numeric(5,4) check (referral_pct is null or (referral_pct > 0 and referral_pct <= 0.5));

alter table public.partner_commissions add column if not exists pro_share numeric(12,2) not null default 0 check (pro_share >= 0);
alter table public.partner_commissions add column if not exists handled_share numeric(12,2);
alter table public.partner_commissions add column if not exists contractor_id uuid references public.contractors(id) on delete set null;
alter table public.partner_commissions add column if not exists pro_share_payout_id uuid references public.payouts(id) on delete set null;
alter table public.partner_commissions drop constraint if exists partner_commissions_shares_check;
alter table public.partner_commissions add constraint partner_commissions_shares_check check (pro_share <= amount) not valid;

-- the pro's half rides the payout run like a clawback (status 'clawback', negative amount)
alter table public.payouts drop constraint if exists payouts_kind_check;
alter table public.payouts add constraint payouts_kind_check
  check (kind in ('job','show_up','guarantee','stipend','materials','clawback','referral','tip','placement','referral_share'));
