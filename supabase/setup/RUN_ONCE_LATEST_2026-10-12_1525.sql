-- ============================================================================
-- FILE    : supabase/setup/RUN_ONCE_LATEST_2026-10-12_1525.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-10-12_1525 UTC
-- PURPOSE : ONE paste for the EXISTING Supabase project — everything added on 2026-10-11 and 2026-10-12
--           (replaces RUN_ONCE_LATEST_2026-10-12_0121.sql; if you already ran an earlier one, running this is still safe):
--             1. cargo insurance documents (freight carriers)          = migration 20261011140500_freight_cargo_coverage.sql
--             2. 3 Lakes Logistics carrier partner record (vetting)   = ADD_3_LAKES_CARRIER_PARTNER_2026-10-11_1405.sql PART 1
--             3. notification log (Hub → Dispatch, job page)          = migration 20261011224200_notification_log.sql
--             4. saved checklists (Hub → Checklists)                  = migration 20261011225000_saved_checklists.sql
--             5. texts inbox, saved homes, pro calendar feed, pro ZIPs = migration 20261012000500_dispatch_gaps.sql
--             6. ID numbers: customers C-, business clients B-, pros P-, staff S- = migration 20261012012100_id_numbers.sql
--             7. Handled Talent flat fee per hire                    = migration 20261012152500_talent_flat_fee.sql
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


-- 6 ─────────────────────────────────────────────────────────────────────────────

create sequence if not exists public.customer_no_seq start 10001;
create sequence if not exists public.client_no_seq start 501;
create sequence if not exists public.pro_no_seq start 1001;
create sequence if not exists public.staff_no_seq start 101;

-- customers ──────────────────────────────────────────────────────────────────
create table if not exists public.customer_ids (
  email text primary key check (email = lower(email)),
  customer_no text not null unique default ('C-' || nextval('public.customer_no_seq')::text),
  profile_id uuid unique references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.customer_ids enable row level security;
drop policy if exists staff_all on public.customer_ids;
create policy staff_all on public.customer_ids for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists own_read on public.customer_ids;
create policy own_read on public.customer_ids for select to authenticated using (profile_id = auth.uid());

-- backfill: every email that has booked or has an account, oldest first
insert into public.customer_ids (email, created_at)
select email, min(at) from (
  select lower(trim(contact_email)) as email, created_at as at from public.jobs where contact_email is not null and contact_email like '%@%'
  union all
  select lower(trim(email)), created_at from public.profiles where email is not null and email like '%@%'
) x where not exists (select 1 from public.customer_ids c where c.email = x.email)
group by email order by min(at)
on conflict (email) do nothing;
update public.customer_ids c set profile_id = p.id
  from public.profiles p where c.profile_id is null and lower(trim(p.email)) = c.email
  and not exists (select 1 from public.customer_ids o where o.profile_id = p.id);

create or replace function public.ensure_customer_id(p_email text, p_profile uuid default null) returns text
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email)); n text;
begin
  if e is null or e not like '%@%' then return null; end if;
  -- already numbered: link the account if it isn't yet (no new number used)
  select customer_no into n from public.customer_ids where email = e;
  if n is not null then
    if p_profile is not null then
      update public.customer_ids set profile_id = p_profile where email = e and profile_id is null
        and not exists (select 1 from public.customer_ids o where o.profile_id = p_profile);
    end if;
    return n;
  end if;
  insert into public.customer_ids (email, profile_id) values (e, p_profile)
    on conflict (email) do update set profile_id = coalesce(public.customer_ids.profile_id, excluded.profile_id)
    returning customer_no into n;
  return n;
exception when unique_violation then
  -- this profile is already linked to another email: keep that link
  insert into public.customer_ids (email) values (e) on conflict (email) do nothing;
  select customer_no into n from public.customer_ids where email = e;
  return n;
end $$;

create or replace function public.jobs_customer_id() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.ensure_customer_id(new.contact_email, new.customer_id);
  return new;
end $$;
drop trigger if exists jobs_customer_id on public.jobs;
create trigger jobs_customer_id after insert on public.jobs for each row execute function public.jobs_customer_id();

-- staff ──────────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists staff_no text unique;
with s as (select id, row_number() over (order by created_at) as r from public.profiles where role in ('admin','dispatcher') and staff_no is null)
update public.profiles p set staff_no = 'S-' || (100 + s.r + coalesce((select max(substr(staff_no, 3)::int) - 100 from public.profiles where staff_no ~ '^S-\d+$'), 0))::text
  from s where p.id = s.id;
do $$ begin
  perform setval('public.staff_no_seq', greatest(101, coalesce((select max(substr(staff_no, 3)::int) + 1 from public.profiles where staff_no ~ '^S-\d+$'), 101)), false);
end $$;

create or replace function public.profiles_ids() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role in ('admin','dispatcher') and new.staff_no is null then
    new.staff_no := 'S-' || nextval('public.staff_no_seq')::text;
  end if;
  return new;
end $$;
drop trigger if exists profiles_ids on public.profiles;
create trigger profiles_ids before insert or update of role on public.profiles for each row execute function public.profiles_ids();

create or replace function public.profiles_customer_id() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.ensure_customer_id(new.email, new.id);
  return new;
end $$;
drop trigger if exists profiles_customer_id on public.profiles;
create trigger profiles_customer_id after insert on public.profiles for each row execute function public.profiles_customer_id();

-- pros ───────────────────────────────────────────────────────────────────────
alter table public.contractors add column if not exists pro_no text unique;
with s as (select id, row_number() over (order by created_at) as r from public.contractors where pro_no is null)
update public.contractors c set pro_no = 'P-' || (1000 + s.r + coalesce((select max(substr(pro_no, 3)::int) - 1000 from public.contractors where pro_no ~ '^P-\d+$'), 0))::text
  from s where c.id = s.id;
do $$ begin
  perform setval('public.pro_no_seq', greatest(1001, coalesce((select max(substr(pro_no, 3)::int) + 1 from public.contractors where pro_no ~ '^P-\d+$'), 1001)), false);
end $$;
alter table public.contractors alter column pro_no set default ('P-' || nextval('public.pro_no_seq')::text);

-- business clients ───────────────────────────────────────────────────────────
alter table public.business_accounts add column if not exists client_no text unique;
with s as (select id, row_number() over (order by created_at) as r from public.business_accounts where client_no is null)
update public.business_accounts b set client_no = 'B-' || (500 + s.r + coalesce((select max(substr(client_no, 3)::int) - 500 from public.business_accounts where client_no ~ '^B-\d+$'), 0))::text
  from s where b.id = s.id;
do $$ begin
  perform setval('public.client_no_seq', greatest(501, coalesce((select max(substr(client_no, 3)::int) + 1 from public.business_accounts where client_no ~ '^B-\d+$'), 501)), false);
end $$;
alter table public.business_accounts alter column client_no set default ('B-' || nextval('public.client_no_seq')::text);


-- 7 ─────────────────────────────────────────────────────────────────────────────
alter table public.talent_searches add column if not exists flat_fee numeric;
alter table public.talent_searches drop constraint if exists talent_searches_type_check;
alter table public.talent_searches add constraint talent_searches_type_check check (type in ('contingency','retained','flat'));
alter table public.talent_searches drop constraint if exists talent_searches_fee_pct_check;
alter table public.talent_searches add constraint talent_searches_fee_pct_check check (fee_pct >= 0 and fee_pct <= 50 and (type = 'flat' or fee_pct > 0));
alter table public.talent_searches drop constraint if exists talent_searches_flat_fee_check;
alter table public.talent_searches add constraint talent_searches_flat_fee_check check (type <> 'flat' or coalesce(flat_fee, 0) > 0);
