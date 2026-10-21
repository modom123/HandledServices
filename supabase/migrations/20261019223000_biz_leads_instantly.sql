-- ============================================================================
-- FILE    : supabase/migrations/20261019223000_biz_leads_instantly.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-19_2230 UTC
-- PURPOSE : Business leads that come from an Instantly campaign run in Instantly (e.g. 1ST OUTREACH DETROIT):
--           source 'instantly' (external_id = the email) so syncBizCampaign and the webhook can add them to the CRM.
-- ============================================================================
alter table public.biz_leads drop constraint if exists biz_leads_source_check;
alter table public.biz_leads add constraint biz_leads_source_check check (source in ('google_places','csv','manual','job_board','instantly'));
