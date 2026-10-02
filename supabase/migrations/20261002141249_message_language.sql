-- ============================================================================
-- FILE    : supabase/migrations/20261002141249_message_language.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-02_1412 UTC
-- PURPOSE : Each person chooses English or Spanish, and every text, email, push notification
--           and timeline entry follows it:
--             • profiles.locale (already exists) — signed-in customers and pros
--             • jobs.locale — the language a booking was made in (guests have no profile)
--             • contractor_applications.locale — applicants, before they have an account
--             • job_events.message_es — Spanish version of each timeline entry
-- ============================================================================
alter table public.jobs add column if not exists locale text not null default 'en' check (locale in ('en','es'));
alter table public.contractor_applications add column if not exists locale text not null default 'en' check (locale in ('en','es'));
alter table public.job_events add column if not exists message_es text;
