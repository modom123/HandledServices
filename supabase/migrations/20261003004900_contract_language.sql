-- ============================================================================
-- FILE    : supabase/migrations/20261003004900_contract_language.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-03_0049 UTC
-- PURPOSE : Contracts in Spanish: record the language each person read when they accepted.
--           The frozen copy (sections) also keeps the Spanish text they saw; English controls.
-- ============================================================================
alter table public.contract_acceptances
  add column if not exists locale text not null default 'en' check (locale in ('en','es'));
