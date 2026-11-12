-- ============================================================================
-- FILE    : supabase/setup/ADD_LEAD_PHOTOS_2026-11-12_1800.sql
-- HOW     : Supabase -> SQL Editor -> paste all of this -> Run (one time).
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-11-12_1800 UTC
-- PURPOSE : Photos on leads. "Post your project" (/post) lets people add up to 6 photos; their storage paths (from
--           /api/uploads, private bucket) are kept on the lead and shown in Hub → Lead inbox. Safe to run twice.
-- ============================================================================
alter table public.leads add column if not exists photos text[] not null default '{}';
