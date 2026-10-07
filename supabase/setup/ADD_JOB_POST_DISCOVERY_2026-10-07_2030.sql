-- ============================================================================
-- FILE    : supabase/setup/ADD_JOB_POST_DISCOVERY_2026-10-07_2030.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-10-07_2030 UTC
-- PURPOSE : For the EXISTING Supabase project: automatic job-posting leads (Michigan + Washington). Same as migration
--           20261007080000_job_post_discovery.sql. Run once in Supabase -> SQL Editor. Safe to run twice.
-- ============================================================================
alter table public.biz_leads drop constraint if exists biz_leads_source_check;
alter table public.biz_leads add constraint biz_leads_source_check check (source in ('google_places','csv','manual','job_board'));
alter table public.biz_leads
  add column if not exists state text,
  add column if not exists posting_pay text check (posting_pay is null or length(posting_pay) <= 40),
  add column if not exists posted_at timestamptz;
create index if not exists biz_leads_company_idx on public.biz_leads (lower(business_name));
alter table public.biz_lead_settings add column if not exists job_posts_per_day int not null default 6 check (job_posts_per_day between 0 and 40);
