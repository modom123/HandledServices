-- ============================================================================
-- FILE    : supabase/setup/RUN_ONCE_ALL_NEW_2026-11-06_0700.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-11-06_0700 UTC
-- PURPOSE : ONE paste for everything added on 2026-11-06 (safe to run twice):
--             1. AI proposal writer + Gov contracts clean-up   (migration 20261106040000_bid_proposals)
--             2. New York, New Jersey, Las Vegas service areas  (migration 20261106050000_ny_nj_nv_service_areas)
--             3. Profile photos on person files                (migration 20261106060000_person_profile_photo)
--           Supabase -> SQL Editor -> New query -> paste this whole file -> Run.
--           Check the price levels in part 2 first — they are starting values.
-- ============================================================================

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

-- ============================================================================
-- FILE    : supabase/migrations/20261106050000_ny_nj_nv_service_areas.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-11-06_0500 UTC
-- PURPOSE : New service areas: New York, New Jersey and Las Vegas (Handled now serves MI, NY, NJ, NV, WA).
--           No launch list → every service is bookable; a booking still needs a vetted pro who covers the ZIP
--           (no pro → waitlist, nothing charged). Area price levels (markets.price_multiplier; Michigan = 1.00,
--           Seattle area = 1.25). STARTING VALUES — change them here or in Hub → Cities as you learn local prices:
--             New York City            100–104, 110–114, 116   +35%  → 1.35
--             NYC suburbs              105–109, 115, 117–119   +30%  → 1.30  (Westchester, Rockland, Long Island)
--             North Jersey             070–076                 +25%  → 1.25
--             Central & South Jersey   077–089                 +15%  → 1.15
--             Las Vegas Valley         889–891                  +5%  → 1.05
--           Upstate New York and the rest of Nevada join a "<state> — new areas" market on their first booking.
--           Safe to run twice.
-- ============================================================================
insert into public.markets (name, state, zip_prefixes, price_multiplier)
select v.name, v.state, v.zips, v.mult from (values
  ('New York City', 'NY', array['100','101','102','103','104','110','111','112','113','114','116'], 1.35),
  ('NYC suburbs', 'NY', array['105','106','107','108','109','115','117','118','119'], 1.30),
  ('North Jersey', 'NJ', array['070','071','072','073','074','075','076'], 1.25),
  ('Central & South Jersey', 'NJ', array['077','078','079','080','081','082','083','084','085','086','087','088','089'], 1.15),
  ('Las Vegas Valley', 'NV', array['889','890','891'], 1.05)
) as v(name, state, zips, mult)
where not exists (select 1 from public.markets m where m.name = v.name);

-- ============================================================================
-- FILE    : supabase/migrations/20261106060000_person_profile_photo.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-11-06_0600 UTC
-- PURPOSE : A profile photo for every person's file (customer, pro, staff, partner, business): staff upload one or pick
--           any photo already in the file, and it shows as their picture at the top of the file. One row per person;
--           the photo stays where it already is (bucket + path). Pros without one fall back to their onboarding photo.
--           Safe to run twice.
-- ============================================================================
create table if not exists public.person_profile_photos (
  owner_type text not null check (owner_type in ('customer','pro','staff','partner','business')),
  owner_key text not null check (length(owner_key) between 3 and 200),
  bucket text not null check (bucket in ('person-files','pro-docs','job-photos')),
  path text not null,
  set_by text,
  set_at timestamptz not null default now(),
  primary key (owner_type, owner_key)
);
alter table public.person_profile_photos enable row level security;
drop policy if exists staff_all on public.person_profile_photos;
create policy staff_all on public.person_profile_photos for all to authenticated using (public.is_staff()) with check (public.is_staff());

