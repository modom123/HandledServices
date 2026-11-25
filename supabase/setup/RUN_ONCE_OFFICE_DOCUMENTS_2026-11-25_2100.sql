-- ============================================================================
-- FILE    : supabase/setup/RUN_ONCE_OFFICE_DOCUMENTS_2026-11-25_2100.sql (same as migrations/20261125210000_office_documents.sql; paste into the Supabase SQL editor)
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-11-25_2100 UTC
-- PURPOSE : Front Office documents (owner, 2026-11-25: upload documents in the office and choose which team members can
--           view them or have full access). Files live in the private office-docs bucket; links are short-lived and
--           made by the server only after checking access.
--             office_documents        one row per document (which office, title, folder, note, who uploaded it)
--             office_document_access  who on the team may see it: 'view' (open and read) or 'full' (also download,
--                                     share with others, rename and remove)
--             office_document_events  history: uploaded, shared, access removed, opened, removed
--           Server-only (staff through the Hub API). Safe to run twice.
-- ============================================================================
insert into storage.buckets (id, name, public) values ('office-docs', 'office-docs', false) on conflict (id) do nothing;

create table if not exists public.office_documents (
  id uuid primary key default gen_random_uuid(),
  office text not null check (office in ('odom','gulley')),
  title text not null,
  folder text,
  note text,
  path text not null unique,
  file_name text,
  content_type text,
  size_bytes bigint,
  uploaded_by uuid,
  uploaded_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by text
);
create index if not exists office_documents_office on public.office_documents (office, created_at desc) where removed_at is null;

create table if not exists public.office_document_access (
  document_id uuid not null references public.office_documents(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  level text not null default 'view' check (level in ('view','full')),
  granted_by text,
  granted_at timestamptz not null default now(),
  last_opened_at timestamptz,
  primary key (document_id, profile_id)
);
create index if not exists office_document_access_person on public.office_document_access (profile_id);

create table if not exists public.office_document_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.office_documents(id) on delete cascade,
  action text not null,
  actor text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists office_document_events_doc on public.office_document_events (document_id, created_at desc);

alter table public.office_documents enable row level security;
alter table public.office_document_access enable row level security;
alter table public.office_document_events enable row level security;
