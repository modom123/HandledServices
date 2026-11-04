-- ============================================================================
-- FILE    : supabase/setup/ADD_MISSING_3_OCT6-7_2026-11-04_2210.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-11-04_2210 UTC
-- PURPOSE : ONE paste for the 3 migrations Mastermind -> Go-live setup reports missing:
--             1. 20261006195000_job_coverage          backup pros per job (job_backups), offer kind 'backup', jobs.handoffs
--             2. 20261006201000_pro_business_address  pro place of business (contractors.base_*)
--             3. 20261007080000_job_post_discovery    job-posting leads (biz_leads.state / posting_pay / posted_at)
--           Constraints use their NEWEST definitions, not the Oct 6-7 originals, so later changes stay intact:
--             pro_standing_events_kind_check keeps 'free_cancel'          (20261006212000_cancellation_tracking)
--             biz_leads_source_check keeps 'instantly' and 'inbound'      (20261019223000, 20261020010000)
--           Safe to run twice. Supabase -> SQL Editor -> New query -> paste this whole file -> Run.
-- ============================================================================

-- 1. Job coverage (backup pros)
create table if not exists public.job_backups (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  rank int not null check (rank between 1 and 3),
  status text not null default 'asked' check (status in ('asked','standby','called','declined','passed','promoted','released')),
  asked_at timestamptz not null default now(),
  responded_at timestamptz,
  called_at timestamptz,
  unique (job_id, contractor_id)
);
create index if not exists job_backups_job_idx on public.job_backups (job_id, rank);
create index if not exists job_backups_pro_idx on public.job_backups (contractor_id, status);
alter table public.job_backups enable row level security;
drop policy if exists "pro reads own backups" on public.job_backups;
create policy "pro reads own backups" on public.job_backups for select to authenticated using (contractor_id = public.my_contractor_id());
drop policy if exists staff_all on public.job_backups;
create policy staff_all on public.job_backups for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.job_offers drop constraint if exists job_offers_kind_check;
alter table public.job_offers add constraint job_offers_kind_check
  check (kind in ('job','recurring','redo','account','favorite','board','backup'));

alter table public.pro_standing_events drop constraint if exists pro_standing_events_kind_check;
alter table public.pro_standing_events add constraint pro_standing_events_kind_check
  check (kind in ('late_cancel','short_notice_cancel','free_cancel','excused_cancel','no_show','warning','suspension','deactivation','appeal','appeal_upheld','reinstated','note'));

alter table public.jobs add column if not exists handoffs int not null default 0;

-- 2. Pro place of business
alter table public.contractors
  add column if not exists base_address text,
  add column if not exists base_city text,
  add column if not exists base_state text check (base_state is null or base_state ~ '^[A-Z]{2}$'),
  add column if not exists base_located text check (base_located is null or base_located in ('address','zip'));

-- 3. Job-post discovery
alter table public.biz_leads drop constraint if exists biz_leads_source_check;
alter table public.biz_leads add constraint biz_leads_source_check
  check (source in ('google_places','csv','manual','job_board','instantly','inbound'));
alter table public.biz_leads
  add column if not exists state text,
  add column if not exists posting_pay text check (posting_pay is null or length(posting_pay) <= 40),
  add column if not exists posted_at timestamptz;
create index if not exists biz_leads_company_idx on public.biz_leads (lower(business_name));
alter table public.biz_lead_settings add column if not exists job_posts_per_day int not null default 6 check (job_posts_per_day between 0 and 40);

-- Refresh the API's table list so the app sees the new table and columns right away
notify pgrst, 'reload schema';
