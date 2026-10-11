-- ============================================================================
-- FILE    : supabase/setup/RUN_ONCE_LATEST_2026-10-11_2250.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-10-11_2250 UTC
-- PURPOSE : ONE paste for the EXISTING Supabase project — everything added on 2026-10-11:
--             1. cargo insurance documents (freight carriers)          = migration 20261011140500_freight_cargo_coverage.sql
--             2. 3 Lakes Logistics carrier partner record (vetting)   = ADD_3_LAKES_CARRIER_PARTNER_2026-10-11_1405.sql PART 1
--             3. notification log (Hub → Dispatch, job page)          = migration 20261011224200_notification_log.sql
--             4. saved checklists (Hub → Checklists)                  = migration 20261011225000_saved_checklists.sql
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
