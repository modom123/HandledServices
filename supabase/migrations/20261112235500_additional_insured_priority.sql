-- ============================================================================
-- FILE    : supabase/migrations/20261112235500_additional_insured_priority.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-11-12_2355 UTC
-- PURPOSE : Job priority for pros whose certificate of insurance names Handled Services LLC as ADDITIONAL INSURED
--           (certificate holder is still accepted, without the priority). Set when the COI is verified — automatically
--           from the AI reading, or by staff in Handled review. Dispatch adds core ADDITIONAL_INSURED_BOOST on jobs that
--           need insurance. Safe to run twice.
-- ============================================================================
alter table public.contractors add column if not exists handled_additional_insured boolean not null default false;
