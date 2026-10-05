-- ============================================================================
-- FILE    : supabase/migrations/20261005021600_job_checklists.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-05_0221 UTC
-- PURPOSE : Job checklists (packages/core/src/checklists.ts): one format for every service.
--             • jobs.checklist        — the checklist frozen when a pro takes the job (text can't change mid-job)
--             • jobs.checklist_extra  — special instructions added to one job (staff, or a customer request
--                                       before the work starts): [{ id, text, required, from, at }]
--             • job_checklist_checks  — each item done or N/A (with the reason), by whom and when. The pro on
--                                       the job and the customer can read them; writes go through the API.
-- ============================================================================
alter table public.jobs
  add column if not exists checklist jsonb,
  add column if not exists checklist_extra jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist_extra) = 'array');

create table if not exists public.job_checklist_checks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  item_id text not null check (length(item_id) between 3 and 80),
  status text not null check (status in ('done','na')),
  note text check (note is null or length(note) <= 500),
  checked_by text,
  checked_at timestamptz not null default now(),
  unique (job_id, item_id),
  check (status <> 'na' or (note is not null and length(trim(note)) >= 3))
);
alter table public.job_checklist_checks enable row level security;
create index if not exists job_checklist_checks_job_idx on public.job_checklist_checks (job_id);
create policy "pro reads own job checks" on public.job_checklist_checks for select to authenticated using (
  exists (select 1 from public.jobs j where j.id = job_id and j.contractor_id = public.my_contractor_id())
);
create policy "customer reads own job checks" on public.job_checklist_checks for select to authenticated using (
  exists (select 1 from public.jobs j where j.id = job_id and j.customer_id = auth.uid())
);
create policy staff_all on public.job_checklist_checks for all to authenticated using (public.is_staff()) with check (public.is_staff());
