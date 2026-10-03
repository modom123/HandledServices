-- ============================================================================
-- FILE    : supabase/migrations/20261003020600_pro_lead_engine.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-03_0206 UTC
-- PURPOSE : Pro lead engine — find independent pros automatically and invite them:
--             • pro_leads         — businesses found (Google Places, CSV import of license lists)
--                                   with trade, area, rating, score, contact, outreach state
--             • pro_lead_events   — every email, click, call, reply, unsubscribe, conversion
--             • lead_engine_settings — one row: on/off, daily caps, trades, sequence timing
--           Email only (with unsubscribe and our postal address); phone-only leads go to a
--           human call list — never automated texts.
-- ============================================================================

create table if not exists public.pro_leads (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 18),
  source text not null check (source in ('google_places','csv','manual')),
  external_id text,                          -- Google place_id, license number…
  business_name text not null,
  contact_name text,
  trade text not null,
  area text,                                 -- ZIP3 or city
  zip text,
  city text,
  phone text,
  email text,
  website text,
  rating numeric(2,1),
  review_count int,
  license_number text,
  score int not null default 0,
  status text not null default 'new' check (status in ('new','queued','emailing','clicked','replied','applied','call','not_interested','unsubscribed','bounced','do_not_contact')),
  step int not null default 0,              -- emails sent so far
  next_send_at timestamptz,
  last_contact_at timestamptz,
  application_id uuid references public.contractor_applications(id) on delete set null,
  details_expire_at timestamptz,             -- Google content is refreshed/cleared after 30 days (their terms)
  notes text,
  created_at timestamptz not null default now(),
  unique (source, external_id)
);
alter table public.pro_leads enable row level security; -- server / staff only
create index if not exists pro_leads_due_idx on public.pro_leads (status, next_send_at);
create index if not exists pro_leads_email_idx on public.pro_leads (lower(email));
create index if not exists pro_leads_trade_idx on public.pro_leads (trade, area);

create table if not exists public.pro_lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.pro_leads(id) on delete cascade,
  kind text not null,
  note text,
  actor text,
  created_at timestamptz not null default now()
);
alter table public.pro_lead_events enable row level security;
create index if not exists pro_lead_events_lead_idx on public.pro_lead_events (lead_id, created_at desc);

create table if not exists public.lead_engine_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  discover_per_day int not null default 10,  -- Places searches per day (trade × area)
  emails_per_day int not null default 40,
  min_rating numeric(2,1) not null default 4.3,
  min_reviews int not null default 5,
  trades text[] not null default '{}',       -- empty = all trades with a supply gap
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.lead_engine_settings enable row level security;
insert into public.lead_engine_settings (id) values (1) on conflict do nothing;

alter table public.contractor_applications add column if not exists lead_id uuid references public.pro_leads(id) on delete set null;
