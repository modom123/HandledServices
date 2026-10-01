-- ============================================================================
-- FILE    : supabase/migrations/20261001203000_service_agreement.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-01_2030 UTC
-- PURPOSE : Every booking is accepted under the customer Service Agreement printed on its
--           invoice. Record which version, when, and from where it was accepted.
-- ============================================================================
alter table public.jobs
  add column terms_version text,
  add column terms_accepted_at timestamptz,
  add column terms_accepted_ip text;
