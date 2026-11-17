-- ============================================================================
-- FILE    : supabase/setup/RUN_ONCE_CALL_APPOINTMENTS_2026-11-17_1530.sql (same as migrations/20261117153000_call_appointments.sql; paste into the Supabase SQL editor)
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-11-17_1530 UTC
-- PURPOSE : Call appointments: a lead can book a time for a Handled person to call (Post your project, the AI project
--           manager). call_at = the booked time (UTC); call_tz = the customer's time zone, for their confirmation.
--           Call hours (days, slot length, people taking calls) live in site_settings, key "call_hours" (Hub -> Lead
--           inbox). Rules: packages/core/src/call-schedule.ts. Server-only columns (leads are admin-read). Safe to run twice.
-- ============================================================================
alter table public.leads add column if not exists call_at timestamptz;
alter table public.leads add column if not exists call_tz text;
create index if not exists leads_call_at_idx on public.leads (call_at) where call_at is not null;
