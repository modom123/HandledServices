-- ============================================================================
-- FILE    : supabase/migrations/20261011225000_saved_checklists.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-11_2250 UTC
-- PURPOSE : Saved checklists — staff-made or edited checklists stored in the job checklist format (Hub → Checklists):
--           pick one, attach it to a job (jobs.checklist) or email it to a pro. Built-in service templates stay in code.
-- ============================================================================
create table if not exists public.saved_checklists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  service_slug text,
  checklist jsonb not null check (jsonb_typeof(checklist) = 'object'),
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists saved_checklists_service_idx on public.saved_checklists (service_slug, name);
alter table public.saved_checklists enable row level security;
drop policy if exists staff_all on public.saved_checklists;
create policy staff_all on public.saved_checklists for all to authenticated using (public.is_staff()) with check (public.is_staff());
