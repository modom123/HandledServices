-- ============================================================================
-- FILE    : supabase/migrations/20261117230000_office_todos.sql (same as setup/RUN_ONCE_OFFICE_TODOS_2026-11-17_2300.sql)
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-11-17_2300 UTC
-- PURPOSE : Front Office offices (Mark Odom, CEO; Cecilia Gulley, Chief Strategy & Recruiting): one shared to-do list
--           that goes back and forth between the two offices. Each item is on one office's desk (assigned_to); either
--           office can send it to the other with a note, and every hand-off is kept in history.
--           Server-only (admins through the Hub API). Safe to run twice.
-- ============================================================================
create table if not exists public.office_todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  details text,
  created_by_office text not null check (created_by_office in ('odom','gulley')),
  assigned_to text not null check (assigned_to in ('odom','gulley')),
  due_date date,
  priority text not null default 'normal' check (priority in ('normal','high')),
  status text not null default 'open' check (status in ('open','done')),
  history jsonb not null default '[]'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists office_todos_desk on public.office_todos (assigned_to, status, due_date);
alter table public.office_todos enable row level security;
