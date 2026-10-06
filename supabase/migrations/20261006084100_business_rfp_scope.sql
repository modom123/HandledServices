-- ============================================================================
-- FILE    : supabase/migrations/20261006084100_business_rfp_scope.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-06_0841 UTC
-- PURPOSE : The business Request for Proposal keeps its scope of work as structured data (packages/core/src/rfp.ts):
--           square footage, site, each service with how often and specifics, working hours, current vendor, term,
--           decision process (and bid due date), walkthrough times, preferred contact. The Hub shows it with a
--           follow-up checklist of what's still missing.
-- ============================================================================
alter table public.business_accounts
  add column if not exists rfp_scope jsonb,
  add column if not exists preferred_contact text check (preferred_contact is null or preferred_contact in ('call','email','text'));
