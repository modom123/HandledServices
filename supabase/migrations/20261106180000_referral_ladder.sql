-- ============================================================================
-- FILE    : supabase/migrations/20261106180000_referral_ladder.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-11-06_1800 UTC
-- PURPOSE : Referral Partner Program partner-v4: one referral rate on every referred job, 15% of the job price rising to
--           30% with the partner's level credit (rules: packages/core/src/partners.ts, REFERRAL_LADDER). Still half paid
--           by the pro (agreement v11) and half by Handled.
--             jobs.partner_rate  - the partner's referral rate locked when the job was booked (shown on the work order).
--                                  null = booked before partner-v4: the job keeps its partner-v2 tier rate.
--           Run after 20261028012200_partner_tickets_tiers.sql. Safe to run twice.
-- ============================================================================
alter table public.jobs add column if not exists partner_rate numeric(5,4);
alter table public.jobs drop constraint if exists jobs_partner_rate_check;
alter table public.jobs add constraint jobs_partner_rate_check check (partner_rate is null or (partner_rate > 0 and partner_rate <= 0.30));
