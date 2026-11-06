-- ============================================================================
-- FILE    : supabase/setup/ADD_PROFILE_PHOTOS_2026-11-06_0600.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-11-06_0600 UTC
-- PURPOSE : ONE paste: profile photos on person files (migration 20261106060000_person_profile_photo).
--           Supabase -> SQL Editor -> New query -> paste this whole file -> Run. Safe to run twice.
-- ============================================================================

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
