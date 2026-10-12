-- ============================================================================
-- FILE    : supabase/setup/RUN_ONCE_LATEST_2026-10-12_0005.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-10-12_0005 UTC
-- PURPOSE : ONE paste for the EXISTING Supabase project — everything added on 2026-10-11 and 2026-10-12
--           (replaces RUN_ONCE_LATEST_2026-10-11_2250.sql; if you already ran that one, running this is still safe):
--             1. cargo insurance documents (freight carriers)          = migration 20261011140500_freight_cargo_coverage.sql
--             2. 3 Lakes Logistics carrier partner record (vetting)   = ADD_3_LAKES_CARRIER_PARTNER_2026-10-11_1405.sql PART 1
--             3. notification log (Hub → Dispatch, job page)          = migration 20261011224200_notification_log.sql
--             4. saved checklists (Hub → Checklists)                  = migration 20261011225000_saved_checklists.sql
--             5. texts inbox, saved homes, pro calendar feed, pro ZIPs = migration 20261012000500_dispatch_gaps.sql
--           Supabase -> SQL Editor -> paste this whole file -> Run. Safe to run twice (skips what already exists).
-- ============================================================================

-- 1 + 2 ───────────────────────────────────────────────────────────────────────
alter table public.contractor_documents drop constraint if exists contractor_documents_kind_check;
alter table public.contractor_documents add constraint contractor_documents_kind_check
  check (kind in ('w9','coi','license','background','agreement','auto','workers_comp','bond','liquor','passenger_auto','cargo','certification','skills','other'));

-- Starts in "vetting": no job offers until insurance, authority, W-9, agreement and payout are verified in the Hub.
-- dispatch@ signs in at /login and completes the pro onboarding; it becomes the company's pro portal login.
insert into public.contractors (business_name, contact_name, email, phone, trades, status, daily_capacity, service_radius_mi, notes)
values (
  '3 Lakes Logistics', 'Mark Odom', 'dispatch@3lakeslogistics.com', '(661) 466-9932',
  array['freight', 'hauling', 'errands', 'medical_courier', 'transportation'],
  'vetting', 20, 100,
  'Carrier partner (3 Lakes Logistics): CDL fleet for Freight & Pallet Delivery, Light Fleet for courier, medical delivery, rides and large-item delivery. Jobs go to 3 Lakes dispatch, which assigns its own drivers (add them as crew). Medicaid NEMT rides stay with 3 Lakes, not Handled. Verify: USDOT/MC on FMCSA SAFER, commercial auto $1M, cargo $100K, passenger carrier auto for rides, HIPAA training for medical delivery.'
)
on conflict (email) do update
  set trades = (select array(select distinct unnest(public.contractors.trades || excluded.trades))),
      notes = excluded.notes,
      daily_capacity = greatest(public.contractors.daily_capacity, excluded.daily_capacity),
      service_radius_mi = greatest(public.contractors.service_radius_mi, excluded.service_radius_mi);


-- 3 ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email','sms','push')),
  recipient text not null,
  subject text,
  preview text,
  status text not null check (status in ('sent','failed','skipped')),
  error text,
  job_id uuid references public.jobs(id) on delete set null,
  job_ref text,
  created_at timestamptz not null default now()
);
create index if not exists notification_log_job_ref_idx on public.notification_log (job_ref, created_at desc);
create index if not exists notification_log_job_id_idx on public.notification_log (job_id, created_at desc);
create index if not exists notification_log_created_idx on public.notification_log (created_at desc);

alter table public.notification_log enable row level security;
drop policy if exists staff_read on public.notification_log;
create policy staff_read on public.notification_log for select to authenticated using (public.is_staff());

-- 4 ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.saved_checklists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  service_slug text,
  checklist jsonb not null check (jsonb_typeof(checklist) = 'object'),
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists saved_checklists_service_idx on public.saved_checklists (service_slug, name);
alter table public.saved_checklists enable row level security;
drop policy if exists staff_all on public.saved_checklists;
create policy staff_all on public.saved_checklists for all to authenticated using (public.is_staff()) with check (public.is_staff());


-- 5 ─────────────────────────────────────────────────────────────────────────────

-- 5.1 texts inbox ───────────────────────────────────────────────────────────────────────────
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

-- 5.3 saved homes ───────────────────────────────────────────────────────────────────────────
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

-- 5.4 calendar feed ───────────────────────────────────────────────────────────────────────────
alter table public.contractors add column if not exists calendar_token text unique;

-- 5.5 pro ZIP codes ───────────────────────────────────────────────────────────────────────────
alter table public.contractors add column if not exists zips_only boolean not null default false;
