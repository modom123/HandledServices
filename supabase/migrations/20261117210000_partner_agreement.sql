-- ============================================================================
-- FILE    : supabase/migrations/20261117210000_partner_agreement.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-11-17_2100 UTC
-- PURPOSE : The Referral Partner Agreement (partner-v6) is a signed contract: contract_acceptances can now record
--           audience 'partner' (who signed, when, IP, the exact text and its hash).
--           partner-v7 (one program): partner_commissions.tier + 'sale' (a direct sale paid on the job price: ladder rate
--           + 5 points). Safe to run twice.
-- ============================================================================
alter table public.contract_acceptances drop constraint if exists contract_acceptances_audience_check;
alter table public.contract_acceptances add constraint contract_acceptances_audience_check
  check (audience in ('customer','business','pro','partner'));

alter table public.partner_commissions drop constraint if exists partner_commissions_tier_check;
alter table public.partner_commissions add constraint partner_commissions_tier_check
  check (tier is null or tier in ('one_time','repeat','account','legacy','direct','self','sale'));
