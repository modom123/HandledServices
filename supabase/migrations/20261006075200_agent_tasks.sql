-- ============================================================================
-- FILE    : supabase/migrations/20261006075200_agent_tasks.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-06_0752 UTC
-- PURPOSE : Tasks the team assigns to the AI agents (Hub → AI agents, or by asking the Ops co-pilot).
--           Each open task is added to that agent's instructions on every run (packages/core/src/mission.ts),
--           and the morning brief reports progress on all of them. agent = the agent's kind
--           (concierge, dispatch, daily_brief…) or 'all' for every agent. Staff only.
-- ============================================================================
create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  agent text not null check (agent ~ '^[a-z_]{2,40}$'),
  title text not null check (char_length(title) between 3 and 300),
  target text check (target is null or char_length(target) <= 200),
  due_date date,
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  note text check (note is null or char_length(note) <= 1000),
  created_by text,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists agent_tasks_open on public.agent_tasks (agent) where status = 'open';

alter table public.agent_tasks enable row level security;
drop policy if exists staff_all on public.agent_tasks;
create policy staff_all on public.agent_tasks for all to authenticated using (public.is_staff()) with check (public.is_staff());
