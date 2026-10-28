-- ============================================================================
-- FILE    : supabase/migrations/20261028224500_pro_orientation.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-10-28_2245 UTC
-- PURPOSE : New pros' portal:
--             • "Welcome to Handled" orientation progress per pro (lesson id → time finished). Finishing every lesson
--               is a required onboarding step before Handled approves a pro (packages/core/src/orientation.ts).
--             • Photos of the job on referral tickets (pros and partners "snap it, ticket it, get paid").
-- ============================================================================
alter table public.contractors add column if not exists orientation jsonb not null default '{}'::jsonb;
alter table public.referral_customers add column if not exists photos text[] not null default '{}';
