-- ============================================================================
-- FILE    : supabase/migrations/20261002134642_launch_checklist.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-02_1346 UTC
-- PURPOSE : Business & legal launch checklist ticks (items live in @handled/core
--           launch-checklist.ts): who ticked it, when, and a note (policy number, attorney…).
-- ============================================================================
create table if not exists public.launch_checklist (
  key text primary key,
  done_at timestamptz,
  done_by text,
  note text,
  updated_at timestamptz not null default now()
);
alter table public.launch_checklist enable row level security;
