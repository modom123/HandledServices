-- ============================================================================
-- FILE    : supabase/migrations/20261002023316_pro_promises.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-02_0233 UTC
-- PURPOSE : What the Pro Program promises, backed by data:
--             • offer status 'taken' — another pro accepted first; doesn't count against
--               anyone's acceptance rate (tiers use real acceptance and on-time numbers)
--             • payout kind 'referral' + contractors.referral_bonus_paid_at — the refer-a-pro
--               bonus is paid automatically, exactly once
--             • payouts.week_of — the automatic Monday payout run each payout went out in
--             • job_offers.kind — 'recurring' (your recurring customer, offered to you first)
--               and 'redo' (your first chance to fix a job) so pros see why they got it
-- ============================================================================
alter type offer_status add value if not exists 'taken';

alter table public.payouts drop constraint if exists payouts_kind_check;
alter table public.payouts add constraint payouts_kind_check
  check (kind in ('job','show_up','guarantee','stipend','materials','clawback','referral'));
alter table public.payouts add column if not exists week_of date;

alter table public.contractors add column if not exists referral_bonus_paid_at timestamptz;

alter table public.job_offers add column if not exists kind text not null default 'job'
  check (kind in ('job','recurring','redo'));
