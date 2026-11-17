-- ============================================================================
-- FILE    : supabase/setup/RUN_ONCE_PARTNER_AGREEMENT_2026-11-17_2100.sql (same as migrations/20261117210000_partner_agreement.sql; paste into the Supabase SQL editor)
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-11-17_2100 UTC
-- PURPOSE : The Referral Partner Agreement (partner-v6) is a signed contract: contract_acceptances can now record
--           audience 'partner' (who signed, when, IP, the exact text and its hash). Safe to run twice.
-- ============================================================================
alter table public.contract_acceptances drop constraint if exists contract_acceptances_audience_check;
alter table public.contract_acceptances add constraint contract_acceptances_audience_check
  check (audience in ('customer','business','pro','partner'));
