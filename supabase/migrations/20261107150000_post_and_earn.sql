-- ============================================================================
-- FILE    : supabase/migrations/20261107150000_post_and_earn.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-11-07_1500 UTC
-- PURPOSE : Post & earn. Someone who posts a project on /post (tick-box, checked by default) joins the Partner Program
--           and earns 10% back, up to $250, on their OWN first project, paid by Handled alone (rules:
--           packages/core/src/partners.ts, FIRST_PROJECT_REWARD).
--             referral_customers.source  - + 'self' (the partner's own first project, from Post your project)
--             partner_commissions.tier   - + 'self' (the first-project reward)
--           Run after 20261106163800_field_sales.sql. Safe to run twice.
-- ============================================================================
alter table public.referral_customers drop constraint if exists referral_customers_source_check;
alter table public.referral_customers add constraint referral_customers_source_check
  check (source in ('link','direct','staff','sale','self'));

alter table public.partner_commissions drop constraint if exists partner_commissions_tier_check;
alter table public.partner_commissions add constraint partner_commissions_tier_check
  check (tier is null or tier in ('one_time','repeat','account','legacy','direct','self'));
