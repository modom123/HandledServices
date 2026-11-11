-- ============================================================================
-- FILE    : supabase/migrations/20261105000000_person_files.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-11-05_0000 UTC
-- PURPOSE : Universal person files (Mastermind → anyone's file: customers, pros, staff, partners, business accounts).
--             person_files   — documents and photos added straight to a person's file (by staff, or by the person),
--                              stored in the private person-files bucket. Uploads that already have a home elsewhere
--                              (pro documents, application résumés, job photos, receipts, quote and ticket photos)
--                              stay where they are; lib/person-files.ts gathers them into the same file view.
--             owner_type / owner_key — who the file belongs to:
--                              customer → lower-case email · pro → contractor id · staff → profile id ·
--                              partner → referral partner id · business → business account id
--           Staff see and manage every file; pros and customers can read their own. Deleting hides a file
--           (deleted_at), so nothing is lost by a mis-click. Safe to run twice.
-- ============================================================================
insert into storage.buckets (id, name, public) values ('person-files', 'person-files', false) on conflict (id) do nothing;

create table if not exists public.person_files (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('customer','pro','staff','partner','business')),
  owner_key text not null check (length(owner_key) between 3 and 200),
  path text not null,
  kind text not null default 'other' check (kind in ('id','contract','resume','photo','insurance','license','tax','receipt','invoice','certification','correspondence','other')),
  label text check (label is null or length(label) <= 200),
  job_id uuid references public.jobs(id) on delete set null,
  content_type text,
  size_bytes int,
  source text not null default 'staff' check (source in ('staff','self','system')),
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_by_name text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by text
);
create unique index if not exists person_files_path_idx on public.person_files (path);
create index if not exists person_files_owner_idx on public.person_files (owner_type, owner_key, created_at desc);

alter table public.person_files enable row level security;
drop policy if exists staff_all on public.person_files;
create policy staff_all on public.person_files for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "pro reads own files" on public.person_files;
create policy "pro reads own files" on public.person_files for select to authenticated
  using (deleted_at is null and owner_type = 'pro' and owner_key = public.my_contractor_id()::text);
drop policy if exists "customer reads own files" on public.person_files;
create policy "customer reads own files" on public.person_files for select to authenticated
  using (deleted_at is null and owner_type = 'customer' and owner_key = lower(coalesce(auth.jwt() ->> 'email', '')));

notify pgrst, 'reload schema';
