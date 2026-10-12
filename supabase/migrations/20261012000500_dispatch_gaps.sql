-- ============================================================================
-- FILE    : supabase/migrations/20261012000500_dispatch_gaps.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-12_0005 UTC
-- PURPOSE : The four scheduling gaps:
--             1. sms_inbox        — every text customers and pros send to the Handled number (two-way texting, Hub → Texts)
--             2. (no table)       — drag-and-drop schedule uses jobs.contractor_id / time_window as is
--             3. customer_homes   — saved home profiles: entry instructions, key / lockbox, key holder, pets, parking,
--                                   preferences; jobs.home_id links a booking to one. job_access holds a job's entry
--                                   details (lockbox code, key) in its own table so only the pro assigned to the job (while
--                                   assigned / in progress), the customer and staff can read it — never pros with an offer
--             4. contractors.calendar_token — secret for the pro's calendar feed (Google / Apple / Outlook subscribe)
--             5. contractors.zips_only — pro coverage: "only send me jobs in these ZIP codes" (service_zips); otherwise the
--                                   driving radius applies and listed ZIPs count even past it
-- ============================================================================

-- 1 ───────────────────────────────────────────────────────────────────────────
create table if not exists public.sms_inbox (
  id uuid primary key default gen_random_uuid(),
  from_number text not null,
  to_number text,
  body text not null default '',
  media_count int not null default 0,
  twilio_sid text unique,
  matched_role text check (matched_role in ('customer','pro','unknown')),
  profile_id uuid references public.profiles(id) on delete set null,
  contractor_id uuid references public.contractors(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  direction text not null default 'in' check (direction in ('in','out')),
  sent_by text,
  handled_at timestamptz,
  handled_by text,
  created_at timestamptz not null default now()
);
create index if not exists sms_inbox_open_idx on public.sms_inbox (handled_at, created_at desc);
create index if not exists sms_inbox_from_idx on public.sms_inbox (from_number, created_at desc);
alter table public.sms_inbox enable row level security;
drop policy if exists staff_all on public.sms_inbox;
create policy staff_all on public.sms_inbox for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- 3 ───────────────────────────────────────────────────────────────────────────
create table if not exists public.customer_homes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'Home' check (length(label) between 1 and 60),
  address text not null,
  city text not null,
  state text not null,
  zip text not null,
  entry_instructions text,
  key_info text,
  key_holder text,
  pets text,
  parking text,
  preferences text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customer_homes_customer_idx on public.customer_homes (customer_id, created_at);
alter table public.customer_homes enable row level security;
drop policy if exists staff_all on public.customer_homes;
create policy staff_all on public.customer_homes for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists customer_own on public.customer_homes;
create policy customer_own on public.customer_homes for all to authenticated using (customer_id = auth.uid()) with check (customer_id = auth.uid());

alter table public.jobs add column if not exists home_id uuid references public.customer_homes(id) on delete set null;

create table if not exists public.job_access (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  access_info text not null,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.job_access enable row level security;
drop policy if exists staff_all on public.job_access;
create policy staff_all on public.job_access for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists pro_assigned on public.job_access;
create policy pro_assigned on public.job_access for select to authenticated using (
  exists (select 1 from public.jobs j where j.id = job_access.job_id and j.contractor_id = public.my_contractor_id() and j.status in ('assigned','in_progress'))
);
drop policy if exists customer_own on public.job_access;
create policy customer_own on public.job_access for select to authenticated using (
  exists (select 1 from public.jobs j where j.id = job_access.job_id and j.customer_id = auth.uid())
);

-- 4 ───────────────────────────────────────────────────────────────────────────
alter table public.contractors add column if not exists calendar_token text unique;

-- 5 ───────────────────────────────────────────────────────────────────────────
alter table public.contractors add column if not exists zips_only boolean not null default false;
