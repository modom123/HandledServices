-- ============================================================================
-- FILE    : supabase/migrations/20261005213900_account_notes.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-05_2141 UTC
-- PURPOSE : Account notes — the running conversation history for every business lead, business account and
--           Handled Talent client: notes, calls, emails, meetings and texts, each with who wrote it and when.
--           Append-only: a note is never edited or deleted (the database refuses), so the history stays complete;
--           a correction is a new note. Status changes and automated events stay in biz_lead_events and are shown
--           in the same timeline.
-- ============================================================================
create table if not exists public.account_notes (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('biz_lead','business_account','talent_client')),
  subject_id uuid not null,
  kind text not null default 'note' check (kind in ('note','call','email','meeting','text','status')),
  body text not null check (length(trim(body)) between 1 and 8000),
  author text not null,
  created_at timestamptz not null default now()
);
create index if not exists account_notes_subject on public.account_notes (subject_type, subject_id, created_at desc);
alter table public.account_notes enable row level security;
create policy staff_read on public.account_notes for select to authenticated using (public.is_staff());
create policy staff_add on public.account_notes for insert to authenticated with check (public.is_staff());

create or replace function public.account_notes_append_only() returns trigger language plpgsql as $$
begin raise exception 'Account notes are permanent — add a new note instead of changing or deleting one'; end $$;
drop trigger if exists account_notes_append_only on public.account_notes;
create trigger account_notes_append_only before update or delete on public.account_notes for each row execute function public.account_notes_append_only();

-- keep what's already written: each lead's existing notes become its first history entry
insert into public.account_notes (subject_type, subject_id, kind, body, author, created_at)
select 'biz_lead', l.id, 'note', l.notes, 'imported', l.created_at
from public.biz_leads l
where l.notes is not null and length(trim(l.notes)) > 0
  and not exists (select 1 from public.account_notes n where n.subject_type = 'biz_lead' and n.subject_id = l.id);
