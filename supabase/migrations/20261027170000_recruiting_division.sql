-- ============================================================================
-- FILE    : supabase/migrations/20261027170000_recruiting_division.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-27_1700 UTC
-- PURPOSE : The Recruiting division (Hub → Recruiting): one place for every role we fill.
--             • talent_clients.internal — Handled itself as a Talent "client", so our own staff roles run through the
--               same pipeline as client searches (no fees: fee_pct may be 0 for internal searches)
--             • talent_searches.public — listed on the public /careers page (applicants apply there or from Indeed)
--             • talent_searches.indeed_url / indeed_posted_at — where the role is posted on Indeed
--             • recruiting_postings — Indeed posting status for openings that aren't searches (independent-pro trades,
--               key "pro:<trade>")
--             • the internal client row: "Handled Services LLC (our team)"
--           Safe to run twice.
-- ============================================================================
alter table public.talent_clients add column if not exists internal boolean not null default false;

alter table public.talent_searches drop constraint if exists talent_searches_fee_pct_check;
alter table public.talent_searches add constraint talent_searches_fee_pct_check check (fee_pct >= 0 and fee_pct <= 50);
alter table public.talent_searches add column if not exists public boolean not null default false;
alter table public.talent_searches add column if not exists indeed_url text;
alter table public.talent_searches add column if not exists indeed_posted_at timestamptz;

create table if not exists public.recruiting_postings (
  opening_key text primary key,
  indeed_url text,
  posted_at timestamptz,
  paused boolean not null default false,
  notes text,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.recruiting_postings enable row level security;
drop policy if exists staff_all on public.recruiting_postings;
create policy staff_all on public.recruiting_postings for all to authenticated using (public.is_staff()) with check (public.is_staff());

insert into public.talent_clients (company, contact_name, email, status, internal, created_by, notes)
select 'Handled Services LLC (our team)', 'Handled hiring', 'info@handledsvc.com', 'active', true, 'migration', 'Internal: our own staff roles. No fees.'
where not exists (select 1 from public.talent_clients where internal);
