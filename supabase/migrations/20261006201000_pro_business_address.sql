-- ============================================================================
-- FILE    : supabase/migrations/20261006201000_pro_business_address.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-06_2010 UTC
-- PURPOSE : A pro's place of business (street, city, state, ZIP). Dispatch measures driving distance from it
--           (geocoded street address; ZIP centre when the lookup isn't available — base_located says which).
-- ============================================================================
alter table public.contractors
  add column if not exists base_address text,
  add column if not exists base_city text,
  add column if not exists base_state text check (base_state is null or base_state ~ '^[A-Z]{2}$'),
  add column if not exists base_located text check (base_located is null or base_located in ('address','zip'));
