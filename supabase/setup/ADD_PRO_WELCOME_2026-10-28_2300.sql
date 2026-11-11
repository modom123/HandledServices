-- ============================================================================
-- FILE    : supabase/setup/ADD_PRO_WELCOME_2026-10-28_2300.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-10-28_2245 UTC
-- PURPOSE : Run once in Supabase → SQL Editor (safe to run twice). New pros' portal:
--             • "Welcome to Handled" orientation progress per pro (lesson id → time finished). Finishing every lesson
--               is a required onboarding step before Handled approves a pro (packages/core/src/orientation.ts).
--             • Photos of the job on referral tickets (pros and partners "snap it, ticket it, get paid").
-- ============================================================================
alter table public.contractors add column if not exists orientation jsonb not null default '{}'::jsonb;
alter table public.referral_customers add column if not exists photos text[] not null default '{}';
