-- ============================================================================
-- FILE    : supabase/migrations/20261005012800_biz_job_posts.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-05_0130 UTC
-- PURPOSE : Business sales engine — job-posting track. A business that posted a job (Indeed and similar)
--           for a cleaner, handyman, maintenance tech, groundskeeper or mover is added by hand in the Hub
--           (job sites don't allow scraping) and gets the "book the work as a service" letter.
--             • biz_leads.job_title / posting_source / posting_url
--             • biz_leads.segment adds 'facilities' (offices, hotels & facilities)
-- ============================================================================
alter table public.biz_leads
  add column if not exists job_title text check (job_title is null or length(job_title) between 2 and 120),
  add column if not exists posting_source text check (posting_source is null or length(posting_source) <= 60),
  add column if not exists posting_url text check (posting_url is null or posting_url ~ '^https?://');
alter table public.biz_leads drop constraint if exists biz_leads_segment_check;
alter table public.biz_leads add constraint biz_leads_segment_check
  check (segment in ('property_manager','real_estate','stager','storage','retail','facilities'));
