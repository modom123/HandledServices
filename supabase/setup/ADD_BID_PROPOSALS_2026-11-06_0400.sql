-- ============================================================================
-- FILE    : supabase/setup/ADD_BID_PROPOSALS_2026-11-06_0400.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-11-06_0400 UTC
-- PURPOSE : ONE paste: the AI proposal writer and Gov contracts clean-up (migration 20261106040000_bid_proposals) —
--           bidding profiles (an IEBC profile is added to start), proposal sections, SAM.gov attachment links,
--           and remembered "not a fit" deletions. Safe to run twice.
--           Supabase -> SQL Editor -> New query -> paste this whole file -> Run.
--           Then run the Gov contracts search once more so the 37 notices pick up their attachment links.
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

-- A starting profile for IEBC (AI automation). Fill in UEI, CAGE, contacts and past performance in Hub → Bids → Bidding profiles.
insert into public.bid_profiles (name, legal_name, business_size, naics, overview, capabilities, differentiators, is_default)
select 'IEBC — AI automation', 'IE Business Consultants', 'Small business',
  '541511, 541512, 541519, 541611, 541690, 518210',
  'IE Business Consultants (IEBC) builds and runs governed AI agent workforces that take on the repetitive back-office and constituent-service work. Agency staff stay in control: each agent has a written role, scoped permissions and an autonomy level the agency sets; high-risk actions wait for approval from a named official; every action is logged for audit.',
  'Back-office automation (intake, forms and document extraction, case triage and routing, records clean-up). Constituent service agents (24/7 Tier-1/Tier-2 chat and email with handoff to staff). Finance and audit automation (invoice audit, vendor reconciliation, grant reporting) with a human certifying official. Process mapping of manual SOPs into measured automated workflows. Data integration: read-only connectors first, then least-privilege write access under the authority to operate (ATO) of the agency.',
  'Proven in production: IEBC agents run dispatch, client care, compliance tracking and finance for Handled, a live multi-trade services company (affiliate). Human oversight built in: suggest / act with approval / autonomous, an approval queue, complete action logs. Fixed-price 30-day pilot with success measures agreed up front. No lock-in: data and workflows exportable; agency data never used to train third-party models. Detroit-based small business.',
  true
where not exists (select 1 from public.bid_profiles);

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
