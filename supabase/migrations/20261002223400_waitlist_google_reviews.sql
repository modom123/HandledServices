-- ============================================================================
-- FILE    : supabase/migrations/20261002223400_waitlist_google_reviews.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-02_2234 UTC
-- PURPOSE : Growth — finding customers and pros:
--             • waitlist — people who asked for a service where we have no pros yet; they're
--               told the day a pro starts covering their ZIP, and the counts drive recruiting
--               (Hub → Supply gaps)
--             • reviews.google_clicked_at — customer tapped "Review us on Google" after rating
-- ============================================================================

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null check (position('@' in email) > 1),
  phone text,
  name text,
  zip text not null check (zip ~ '^[0-9]{5}$'),
  service_slug text not null,
  locale text not null default 'en' check (locale in ('en','es')),
  profile_id uuid references public.profiles(id) on delete set null,
  source text not null default 'booking',
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  unique (email, service_slug, zip)
);
alter table public.waitlist enable row level security; -- written and read by the server only
create index if not exists waitlist_open_idx on public.waitlist (service_slug, zip) where notified_at is null;

alter table public.reviews add column if not exists google_clicked_at timestamptz;
