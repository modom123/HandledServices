-- ============================================================================
-- FILE    : supabase/migrations/20261106040000_bid_proposals.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-11-06_0400 UTC
-- PURPOSE : AI proposal writer for the bid engine (Hub → Bids).
--             • bid_profiles: who we bid as (e.g. IEBC for AI automation, Handled for services). The facts the AI may use:
--               UEI / CAGE, contacts, capabilities, past performance, key people, standard language
--             • bids: profile_id, the format rules the solicitation sets, and the AI's red-team review of the draft
--             • bid_proposal_sections: the proposal, section by section (outline → AI draft → edited → approved)
--             • gov_opportunities: resource_links — the notice's SAM.gov attachments, so they can be pulled into a bid
-- ============================================================================
create table if not exists public.bid_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  uei text,
  cage text,
  address text,
  poc_name text,
  poc_title text,
  email text,
  phone text,
  website text,
  business_size text,
  certifications text,
  naics text,
  overview text,
  capabilities text,
  differentiators text,
  past_performance text,
  key_personnel text,
  boilerplate text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.bid_profiles enable row level security;
drop policy if exists staff_all on public.bid_profiles;
create policy staff_all on public.bid_profiles for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.bids add column if not exists profile_id uuid references public.bid_profiles(id) on delete set null;
alter table public.bids add column if not exists proposal_format text;
alter table public.bids add column if not exists proposal_review jsonb;

create table if not exists public.bid_proposal_sections (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid not null references public.bids(id) on delete cascade,
  sort int not null default 0,
  title text not null,
  guidance text,
  page_limit numeric,
  requirement_ids uuid[] not null default '{}',
  content text not null default btrim(' '),  -- empty text, written so it survives copy and paste
  status text not null default 'outline' check (status in ('outline','draft','edited','approved')),
  ai_at timestamptz,
  edited_by text,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bid_proposal_sections_bid on public.bid_proposal_sections (bid_id, sort);
alter table public.bid_proposal_sections enable row level security;
drop policy if exists staff_all on public.bid_proposal_sections;
create policy staff_all on public.bid_proposal_sections for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.gov_opportunities add column if not exists resource_links jsonb;

-- The starting IEBC profile is created by the app the first time Hub -> Bids -> Bidding profiles opens (lib/proposals.ts).

-- attachment downloads count against the SAM.gov daily call budget like every other call
alter table public.gov_api_calls drop constraint if exists gov_api_calls_kind_check;
alter table public.gov_api_calls add constraint gov_api_calls_kind_check check (kind in ('search','description','awards','attachment'));

-- notices deleted from Gov contracts as "not a fit": remembered so the daily search never adds them back
create table if not exists public.gov_dismissed (
  notice_id text primary key,
  title text,
  reason text,
  dismissed_by text,
  dismissed_at timestamptz not null default now()
);
alter table public.gov_dismissed enable row level security;
drop policy if exists staff_all on public.gov_dismissed;
create policy staff_all on public.gov_dismissed for all to authenticated using (public.is_staff()) with check (public.is_staff());
