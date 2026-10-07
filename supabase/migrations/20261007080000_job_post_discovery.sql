-- ============================================================================
-- FILE    : supabase/migrations/20261007080000_job_post_discovery.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-07_2030 UTC
-- PURPOSE : Automatic job-posting leads: businesses in Michigan and Washington hiring for work we do (cleaner, janitor,
--           porter, maintenance…) found daily through a licensed job-search API (Adzuna), then emailed the
--           "book it as a service instead of hiring" sequence.
--             • biz_leads.source adds 'job_board'; new columns state, posting_pay, posted_at
--             • biz_lead_settings.job_posts_per_day — searches per weekday (0 = off)
--           Safe to run twice.
-- ============================================================================
alter table public.biz_leads drop constraint if exists biz_leads_source_check;
alter table public.biz_leads add constraint biz_leads_source_check check (source in ('google_places','csv','manual','job_board'));
alter table public.biz_leads
  add column if not exists state text,
  add column if not exists posting_pay text check (posting_pay is null or length(posting_pay) <= 40),
  add column if not exists posted_at timestamptz;
create index if not exists biz_leads_company_idx on public.biz_leads (lower(business_name));
alter table public.biz_lead_settings add column if not exists job_posts_per_day int not null default 6 check (job_posts_per_day between 0 and 40);
