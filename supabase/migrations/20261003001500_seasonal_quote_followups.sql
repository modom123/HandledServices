-- ============================================================================
-- FILE    : supabase/migrations/20261003001500_seasonal_quote_followups.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-03_0015 UTC
-- PURPOSE : Bringing customers back:
--             • saved_quotes     — "Email me this price": the price, then follow-ups, with a link
--                                  that reopens the booking with their answers filled in
--             • marketing_sends  — every seasonal reminder / quote follow-up sent (never twice,
--                                  at most one seasonal email a month per person)
--             • email_optouts    — one-click unsubscribe from reminders (booking messages still go)
-- ============================================================================

create table if not exists public.saved_quotes (
  id uuid primary key default gen_random_uuid(),
  email text not null check (position('@' in email) > 1),
  service_slug text not null,
  answers jsonb not null default '{}',
  frequency text not null default 'once',
  price numeric(10,2),
  locale text not null default 'en' check (locale in ('en','es')),
  profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  followups_sent int not null default 0,
  last_followup_at timestamptz,
  booked_job_id uuid references public.jobs(id) on delete set null
);
alter table public.saved_quotes enable row level security; -- server only
create index if not exists saved_quotes_open_idx on public.saved_quotes (created_at) where booked_job_id is null;
create index if not exists saved_quotes_email_idx on public.saved_quotes (lower(email));

create table if not exists public.marketing_sends (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  kind text not null check (kind in ('seasonal','quote_followup','booking_followup')),
  key text not null,
  job_id uuid references public.jobs(id) on delete set null,
  sent_at timestamptz not null default now(),
  unique (email, kind, key)
);
alter table public.marketing_sends enable row level security;
create index if not exists marketing_sends_recent_idx on public.marketing_sends (lower(email), sent_at desc);

create table if not exists public.email_optouts (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table public.email_optouts enable row level security;
