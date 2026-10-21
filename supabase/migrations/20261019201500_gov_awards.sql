-- ============================================================================
-- FILE    : supabase/migrations/20261019201500_gov_awards.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-19_2015 UTC
-- PURPOSE : Federal contract AWARDS from SAM.gov's Contract Awards API (packages/core/src/gov-awards.ts,
--           Hub → Gov contracts → Awards & recompetes).
--             • gov_awards      — one row per contract (base award + modifications merged): who holds it, value,
--                                 end date, place of work, recompete fit score, our watch status and notes
--             • gov_settings    — awards_enabled / awards_months_back / awards_pages for the weekly awards run
--             • gov_api_calls   — 'awards' added as a call kind (same key and daily budget as opportunities)
--           Staff only. The SAM.gov API key stays in Vercel (SAM_API_KEY).
-- ============================================================================
create table if not exists public.gov_awards (
  award_key text primary key,
  piid text not null,
  referenced_idv_piid text,
  modification_number text,
  agency text,
  subtier text,
  office text,
  awardee text,
  awardee_uei text,
  awardee_city text,
  awardee_state text,
  naics text,
  naics_title text,
  psc text,
  psc_title text,
  set_aside_code text,
  set_aside text,
  description text,
  solicitation_id text,
  offers_received int,
  date_signed date,
  pop_start date,
  current_end date,
  ultimate_end date,
  obligated numeric,
  total_value numeric,
  pop_city text,
  pop_state text,
  pop_zip text,
  fit_score int not null default 0,
  fit jsonb,
  services text[] not null default '{}'::text[],
  status text not null default 'new' check (status in ('new','watching','ignored')),
  notes text,
  raw jsonb,
  first_seen timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gov_awards_fit on public.gov_awards (status, fit_score desc);
create index if not exists gov_awards_end on public.gov_awards (ultimate_end);
create index if not exists gov_awards_awardee on public.gov_awards (awardee_uei);
alter table public.gov_awards enable row level security;
create policy staff_all on public.gov_awards for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.gov_settings add column if not exists awards_enabled boolean not null default false;
alter table public.gov_settings add column if not exists awards_months_back int not null default 24 check (awards_months_back between 1 and 60);
alter table public.gov_settings add column if not exists awards_pages int not null default 2 check (awards_pages between 1 and 20);

alter table public.gov_api_calls drop constraint if exists gov_api_calls_kind_check;
alter table public.gov_api_calls add constraint gov_api_calls_kind_check check (kind in ('search','description','awards'));
