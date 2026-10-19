-- ============================================================================
-- FILE    : supabase/setup/ADD_INSTANTLY_CRM_SYNC_2026-10-19_2230.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-10-19_2230 UTC
-- PURPOSE : ONE paste for the EXISTING Supabase project — leads from the Instantly campaign 1ST OUTREACH DETROIT go into
--           Hub → Business leads = migration 20261019223000_biz_leads_instantly.sql.
--           Supabase -> SQL Editor -> paste this whole file -> Run. Safe to run twice.
-- ============================================================================

alter table public.biz_leads drop constraint if exists biz_leads_source_check;
alter table public.biz_leads add constraint biz_leads_source_check check (source in ('google_places','csv','manual','job_board','instantly'));
