-- ============================================================================
-- FILE    : supabase/setup/HANDLED_UPDATE_BACKUPS_2026-10-06_1956.sql
-- PROJECT : Handled (HandledServices)
-- CREATED : 2026-10-06_1956 UTC
-- PURPOSE : EXISTING project: job coverage (backups #1-#3, cancel tiers). Run AFTER HANDLED_UPDATE_TODAY.
--           Safe to run more than once; all or nothing. Supabase -> SQL Editor -> paste -> Run.
-- ============================================================================
begin;
-- ============================================================================
-- FILE    : supabase/migrations/20261006195000_job_coverage.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-06_1950 UTC
-- PURPOSE : Every job gets done (packages/core/src/coverage.ts).
--             * job_backups - backup #1, #2, #3 lined up behind the pro on every accepted job. Status:
--                 asked (we asked) -> standby (they confirmed they can cover) -> called (the pro dropped; their turn)
--                 -> promoted (they took the job) - declined / passed (said no) - released (job done or cancelled)
--             * job_offers.kind adds 'backup' (the call that goes to a backup when the pro drops)
--             * pro_standing_events.kind adds 'short_notice_cancel' (6-24h: logged, no penalty) and 'excused_cancel'
--             * jobs.handoffs - how many times the job changed pros (shown to staff)
-- ============================================================================
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
  check (kind in ('late_cancel','short_notice_cancel','excused_cancel','no_show','warning','suspension','deactivation','appeal','appeal_upheld','reinstated','note'));

alter table public.jobs add column if not exists handoffs int not null default 0;

commit;
