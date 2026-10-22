-- ============================================================================
-- FILE    : supabase/setup/ADD_BACKGROUND_CHECK_OVER_TIME_2026-10-22_1200.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-22_1200 UTC
-- PURPOSE : One paste in Supabase → SQL Editor → Run (same as migrations/20261022120000_background_check_over_time.sql).
--           Background check, PAID OVER TIME. Handled pays the screening provider (Checkr) when the check is ordered, so
--           no one is held back by the cost. The pro repays it from completed jobs - a set amount per job, never more than
--           a share of that job's pay - shown as its own line on the payout statement. Nothing is owed without jobs
--           (no bills, no collections). Optional refund when the pro completes enough jobs early. Rules and amounts:
--           Hub -> Pro Program -> 7 (packages/core/src/pro-policy.ts backgroundCheck). Yearly re-checks: Handled pays.
--             contractors.background_fee          - what this pro's first check cost (set when it's ordered; null = Handled paid)
--             contractors.background_fee_repaid   - repaid so far
--             contractors.background_fee_refunded_at - refunded after enough early jobs
--             payouts.kind 'background_check'     - a repayment (negative, netted like a clawback) or the refund (positive)
--           Safe to run twice.
-- ============================================================================
alter table public.contractors add column if not exists background_fee numeric(10,2) check (background_fee is null or background_fee >= 0);
alter table public.contractors add column if not exists background_fee_repaid numeric(10,2) not null default 0 check (background_fee_repaid >= 0);
alter table public.contractors add column if not exists background_fee_refunded_at timestamptz;
alter table public.contractors drop constraint if exists contractors_background_fee_check2;
alter table public.contractors add constraint contractors_background_fee_check2 check (background_fee is null or background_fee_repaid <= background_fee) not valid;

alter table public.payouts drop constraint if exists payouts_kind_check;
alter table public.payouts add constraint payouts_kind_check
  check (kind in ('job','show_up','guarantee','stipend','materials','clawback','referral','tip','placement','referral_share','background_check'));
