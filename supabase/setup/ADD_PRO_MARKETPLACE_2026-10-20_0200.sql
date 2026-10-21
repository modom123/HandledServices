-- ============================================================================
-- FILE    : supabase/setup/ADD_PRO_MARKETPLACE_2026-10-20_0200.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-10-20_0200 UTC
-- PURPOSE : ONE paste for the EXISTING Supabase project — pros set their own prices (80–175%), price choices at booking,
--           and request-a-quote for big jobs = migration 20261020020000_pro_marketplace.sql.
--           Supabase -> SQL Editor -> paste this whole file -> Run. Safe to run twice.
-- ============================================================================

create table if not exists public.pro_rates (
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  service_slug text not null,
  pct int not null check (pct between 80 and 175),
  min_job numeric check (min_job is null or min_job between 0 and 100000),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (contractor_id, service_slug)
);
create index if not exists pro_rates_service on public.pro_rates (service_slug) where active;
alter table public.pro_rates enable row level security;
drop policy if exists staff_all on public.pro_rates;
create policy staff_all on public.pro_rates for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.jobs add column if not exists priced_by text check (priced_by is null or priced_by in ('engine','offer','pro_rate','quote'));
alter table public.jobs add column if not exists pro_rate_pct int;

create table if not exists public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 24),
  customer_id uuid references public.profiles(id) on delete set null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  service_slug text not null,
  description text not null,
  zip text not null,
  city text,
  preferred_date date,
  photos text[] not null default '{}'::text[],
  status text not null default 'open' check (status in ('open','quoted','booked','expired','cancelled')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  job_id uuid references public.jobs(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists quote_requests_status on public.quote_requests (status, created_at desc);
alter table public.quote_requests enable row level security;
drop policy if exists staff_all on public.quote_requests;
create policy staff_all on public.quote_requests for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.quote_bids (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.quote_requests(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  token text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 24),
  status text not null default 'invited' check (status in ('invited','quoted','declined','expired','chosen','lost')),
  pay numeric check (pay is null or pay > 0),
  price numeric check (price is null or price > 0),
  earliest_date date,
  note text,
  invited_at timestamptz not null default now(),
  quoted_at timestamptz,
  unique (request_id, contractor_id)
);
create index if not exists quote_bids_request on public.quote_bids (request_id);
alter table public.quote_bids enable row level security;
drop policy if exists staff_all on public.quote_bids;
create policy staff_all on public.quote_bids for all to authenticated using (public.is_staff()) with check (public.is_staff());
