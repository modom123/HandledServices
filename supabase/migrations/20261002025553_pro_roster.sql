-- ============================================================================
-- FILE    : supabase/migrations/20261002025553_pro_roster.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-02_0255 UTC
-- PURPOSE : Know where pros are and when they can work:
--             • on_call_until — the pro switched "On call" on (same-day work) until this time
--             • last_lat / last_lng / last_located_at — last phone location, shared only while
--               on call or on a job today; the daily sweep clears it after 12 hours
--           Their calendar (jobs ahead, days off, daily limit) uses existing columns.
-- ============================================================================
alter table public.contractors
  add column if not exists on_call_until timestamptz,
  add column if not exists last_lat double precision,
  add column if not exists last_lng double precision,
  add column if not exists last_located_at timestamptz;

create index if not exists contractors_on_call_idx on public.contractors (on_call_until) where on_call_until is not null;
create index if not exists jobs_contractor_date_idx on public.jobs (contractor_id, scheduled_date);
