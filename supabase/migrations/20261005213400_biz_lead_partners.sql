-- ============================================================================
-- FILE    : supabase/migrations/20261005213400_biz_lead_partners.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-05_2134 UTC
-- PURPOSE : Business leads can be teaming partners (segment 'partner'): firms we bid public contracts with.
--           Tracked in Hub → Business leads, never discovered, emailed by the sales sequence or included in
--           Email Center blasts (enforced in lib/biz-leads.ts and lib/email-center.ts).
-- ============================================================================
alter table public.biz_leads drop constraint if exists biz_leads_segment_check;
alter table public.biz_leads add constraint biz_leads_segment_check
  check (segment in ('property_manager','real_estate','stager','storage','retail','facilities','partner'));
