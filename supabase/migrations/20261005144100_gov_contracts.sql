-- ============================================================================
-- FILE    : supabase/migrations/20261005144100_gov_contracts.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-05_1441 UTC
-- PURPOSE : Government contracts from SAM.gov (packages/core/src/gov-contracts.ts, Hub → Gov contracts).
--             • gov_settings       — the saved daily search: on/off, NAICS codes, state, keywords, notice types, days back,
--                                    daily API call budget, certifications we hold (for set-asides)
--             • gov_opportunities  — every notice we've pulled (cached so the 10-calls-a-day key goes far), its fit
--                                    score, our pipeline status (new → reviewing → bidding → submitted → won / lost,
--                                    or passed), notes, the full description and the AI bid summary
--             • gov_api_calls      — one row per SAM.gov call, to stay inside the daily budget
--             • gov_pro_interest   — pros we've asked about an opportunity and their answer (capacity, rate)
--           Staff only. The SAM.gov API key lives in Vercel (SAM_API_KEY), never in the database.
-- ============================================================================
create table if not exists public.gov_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  naics text[] not null default array['561720','561730','561790','561612','562111','484210']::text[],
  state text default 'MI',
  keywords text,
  ptypes text[] not null default array['o','k','p','r']::text[],
  days_back int not null default 7 check (days_back between 1 and 364),
  daily_call_budget int not null default 8 check (daily_call_budget between 1 and 1000),
  certifications text[] not null default '{}'::text[],
  last_run_at timestamptz,
  last_result jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.gov_settings enable row level security;
create policy staff_all on public.gov_settings for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.gov_opportunities (
  notice_id text primary key,
  title text not null,
  solicitation_number text,
  agency text,
  office text,
  notice_type text,
  ptype text,
  set_aside_code text,
  set_aside text,
  naics text,
  psc text,
  posted_date date,
  response_deadline timestamptz,
  archive_date date,
  active boolean not null default true,
  pop_city text,
  pop_state text,
  pop_zip text,
  ui_link text,
  description_url text,
  contacts jsonb not null default '[]'::jsonb,
  award_amount numeric,
  awardee text,
  fit_score int not null default 0,
  fit jsonb,
  services text[] not null default '{}'::text[],
  status text not null default 'new' check (status in ('new','reviewing','bidding','submitted','won','lost','passed')),
  owner text,
  notes text,
  description text,
  ai_summary jsonb,
  raw jsonb,
  first_seen timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gov_opportunities_fit on public.gov_opportunities (status, fit_score desc);
create index if not exists gov_opportunities_deadline on public.gov_opportunities (response_deadline);
alter table public.gov_opportunities enable row level security;
create policy staff_all on public.gov_opportunities for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.gov_api_calls (
  id bigserial primary key,
  called_at timestamptz not null default now(),
  kind text not null default 'search' check (kind in ('search','description')),
  query text,
  ok boolean not null default true,
  records int,
  error text,
  actor text not null default 'system'
);
create index if not exists gov_api_calls_day on public.gov_api_calls (called_at);
alter table public.gov_api_calls enable row level security;
create policy staff_all on public.gov_api_calls for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.gov_pro_interest (
  notice_id text not null references public.gov_opportunities(notice_id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  status text not null default 'asked' check (status in ('asked','interested','not_interested')),
  note text,
  asked_at timestamptz not null default now(),
  answered_at timestamptz,
  primary key (notice_id, contractor_id)
);
alter table public.gov_pro_interest enable row level security;
create policy staff_all on public.gov_pro_interest for all to authenticated using (public.is_staff()) with check (public.is_staff());

insert into public.gov_settings (id) values (1) on conflict (id) do nothing;
