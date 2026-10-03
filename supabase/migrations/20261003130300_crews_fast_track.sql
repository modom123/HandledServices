-- ============================================================================
-- FILE    : supabase/migrations/20261003130300_crews_fast_track.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-03_1303 UTC
-- PURPOSE : Crew accounts and the proven-skill fast track.
--             • crew_members      — people a pro company sends to jobs (helpers, apprentices,
--                                   licensed techs). Each one who enters a customer's home passes
--                                   our background check first (Pro Agreement: helpers). The
--                                   company pays and directs them and handles their work
--                                   authorization, payroll and workers' comp (Crew Addendum).
--             • jobs.crew_member_id — who the company is sending (shown to the customer)
--             • contractors.crew_* — the owner's crew attestation (signed with the Crew Addendum)
--             • contractors.fast_track_* / tier_floor — a master of their trade sends a portfolio,
--                                   does one paid trial job we review, and starts at Pro+
-- ============================================================================

create table if not exists public.crew_members (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  full_name text not null check (length(full_name) between 2 and 120),
  phone text,
  email text,
  locale text not null default 'en' check (locale in ('en','es')),
  role text not null default 'helper' check (role in ('lead','helper','apprentice','licensed')),
  trades text[] not null default '{}',
  years_experience int check (years_experience is null or years_experience between 0 and 70),
  license_number text,
  background_status text not null default 'not_started' check (background_status in ('not_started','invited','pending','clear','consider','suspended','canceled')),
  background_provider_id text,
  background_checked_at timestamptz,
  active boolean not null default true,
  removed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.crew_members enable row level security;
create index if not exists crew_members_pro_idx on public.crew_members (contractor_id) where active;
create index if not exists crew_members_checkr_idx on public.crew_members (background_provider_id) where background_provider_id is not null;
create policy "pro reads own crew" on public.crew_members for select using (
  contractor_id in (select id from public.contractors where profile_id = auth.uid())
);
create policy staff_all on public.crew_members for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.jobs
  add column if not exists crew_member_id uuid references public.crew_members(id) on delete set null;

alter table public.contractors
  add column if not exists crew_attested_at timestamptz,
  add column if not exists crew_attestation jsonb,
  add column if not exists fast_track_status text not null default 'none'
    check (fast_track_status in ('none','applied','trial','approved','declined')),
  add column if not exists fast_track jsonb,
  add column if not exists fast_track_applied_at timestamptz,
  add column if not exists fast_track_trial_job_id uuid references public.jobs(id) on delete set null,
  add column if not exists fast_track_decided_at timestamptz,
  add column if not exists fast_track_decided_by text,
  add column if not exists fast_track_note text,
  add column if not exists tier_floor text check (tier_floor is null or tier_floor in ('pro_plus'));
