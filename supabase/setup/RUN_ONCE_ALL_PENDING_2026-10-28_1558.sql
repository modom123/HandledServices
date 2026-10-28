-- ============================================================================
-- FILE    : supabase/setup/RUN_ONCE_ALL_PENDING_2026-10-28_1558.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-10-28_1558 UTC
-- PURPOSE : ONE paste that brings the EXISTING Supabase project (built from HANDLED_SETUP_2026-10-09_0242.sql) fully up
--           to date — every database change since that setup, in order (replaces RUN_ONCE_ALL_SINCE_SETUP_2026-10-27_1530.sql):
--             1. RUN_ONCE_ALL_SINCE_SETUP_2026-10-27_1530   everything from 2026-10-11 to 2026-10-23: cargo insurance,
--                                                          notification log, saved checklists, texts inbox / saved homes /
--                                                          pro ZIPs, ID numbers, Talent flat fee, book now pay after, pro
--                                                          resume & photo, gov awards & subcontracting, Instantly CRM sync,
--                                                          AI bid desk, call desk, omnichannel, pro marketplace & quotes,
--                                                          recruiting intake
--             2. ADD_RECRUITING_DIVISION_2026-10-27_1700    Recruiting division: internal roles, /careers, Indeed postings
--             3. ADD_PARTNER_TICKETS_2026-10-28_0122        Referral partners: 25% / 10% / 15% rates and referral tickets
--           Already ran some of these? Run this anyway: every part is safe to run twice (it skips what already exists).
--           Supabase -> SQL Editor -> New query -> paste this whole file -> Run. Then Hub -> Setup shows every
--           database change as done.
-- ============================================================================


-- ============================================================================
-- PART 1 of 3: RUN_ONCE_ALL_SINCE_SETUP_2026-10-27_1530.sql
-- ============================================================================

-- ============================================================================
-- FILE    : supabase/setup/RUN_ONCE_ALL_SINCE_SETUP_2026-10-27_1530.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-10-27_1530 UTC
-- PURPOSE : ONE paste that brings the EXISTING Supabase project (built from HANDLED_SETUP_2026-10-09_0242.sql) fully up to
--           date — every database change from 2026-10-11 to 2026-10-23, in order:
--             1. RUN_ONCE_LATEST_2026-10-12_1525   cargo insurance, 3 Lakes carrier, notification log, saved checklists,
--                                                  texts inbox / saved homes / pro ZIPs, ID numbers, Talent flat fee
--             2. ADD_BOOK_NOW_PAY_AFTER_2026-10-15  book now, pay after (25% at booking)
--             3. ADD_PRO_RESUME_PHOTO_2026-10-18    pro resume & profile photo uploads, business W-9 types
--             4. RUN_ONCE_ALL_NEW_2026-10-21        gov awards, subcontracting, Instantly CRM sync, AI bid desk, call desk,
--                                                  omnichannel lead inbox & social, pro marketplace & quotes
--             5. ADD_RECRUITING_INTAKE_2026-10-23   recruiting: add candidates by hand, CSV import, Indeed Apply
--           Already ran some of these? Run this anyway: every part is safe to run twice (it skips what already exists).
--           Supabase -> SQL Editor -> New query -> paste this whole file -> Run.
--           Carpentry, Masonry & Concrete and Roofing need no SQL: new services are added to the database automatically
--           before the first booking.
-- ============================================================================


-- ============================================================================
-- PART 1 of 5: RUN_ONCE_LATEST_2026-10-12_1525.sql
-- ============================================================================

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


-- ============================================================================
-- PART 2 of 5: ADD_BOOK_NOW_PAY_AFTER_2026-10-15_0300.sql
-- ============================================================================

-- ============================================================================
-- FILE    : supabase/setup/ADD_BOOK_NOW_PAY_AFTER_2026-10-15_0300.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-15_0300 UTC
-- PURPOSE : Book now, pay the rest when it's done (packages/core/src/pricing.ts → BOOK_NOW, PAY_IN_FULL).
--             • jobs.payment_plan adds 'after': 25% at booking (deposit_amount / deposit_paid_at); the balance is held
--               on the card when the pro starts (balance_hold_intent, a Stripe authorization) and charged when the job
--               is complete; a failed charge is retried daily (balance_charge_at = next try, balance_attempts)
--             • pay_in_full_discount: the 5% saving for paying in full at booking (taken from our share)
--           Same as migration 20261015030000_book_now_pay_after.sql. Supabase -> SQL Editor -> paste this whole
--           file -> Run. Safe to run twice. Run it BEFORE deploying the code that offers "pay 25% now".
-- ============================================================================

alter table public.jobs drop constraint if exists jobs_payment_plan_check;
alter table public.jobs add constraint jobs_payment_plan_check check (payment_plan in ('full','deposit','after'));

alter table public.jobs
  add column if not exists balance_charge_at timestamptz,
  add column if not exists balance_attempts int not null default 0,
  add column if not exists balance_hold_intent text,
  add column if not exists pay_in_full_discount numeric(10,2) not null default 0;

-- the daily sweep looks for balances that are due
create index if not exists jobs_balance_charge_idx on public.jobs (balance_charge_at) where payment_plan = 'after' and paid_at is null;


-- ============================================================================
-- PART 3 of 5: ADD_PRO_RESUME_PHOTO_2026-10-18_0248.sql
-- ============================================================================

-- ============================================================================
-- FILE    : supabase/setup/ADD_PRO_RESUME_PHOTO_2026-10-18_0248.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-10-18_0248 UTC
-- PURPOSE : For the EXISTING Supabase project: resume and profile photo steps in pro onboarding, and the
--           "missing uploads" reminders. Same as migration 20261018024800_pro_resume_photo.sql.
-- UPDATED : 2026-10-18_0415 UTC — also: LLCs taxed as S/C corporations on the W-9, and signing the pro agreement for a
--           business (name + title). Already ran the earlier version? Run this one again — it's safe.
--           Run once in Supabase -> SQL Editor. Safe to run twice. Run it BEFORE deploying the code that uses it.
-- ============================================================================
alter table public.contractors
  add column if not exists resume_uploaded_at timestamptz,
  add column if not exists photo_uploaded_at timestamptz,
  add column if not exists upload_reminders int not null default 0,
  add column if not exists last_upload_reminder_at timestamptz;

alter table public.contractor_documents drop constraint if exists contractor_documents_kind_check;
alter table public.contractor_documents add constraint contractor_documents_kind_check
  check (kind in ('w9','coi','license','background','agreement','auto','workers_comp','bond','liquor','passenger_auto','cargo','certification','skills','resume','photo','other'));

-- 2026-10-18_0415: pros that are businesses — W-9 classification for LLCs taxed as S/C corporations (no 1099-NEC),
-- and who signed the agreement for which business (and their title).
alter table public.contractors drop constraint if exists contractors_entity_type_check;
alter table public.contractors add constraint contractors_entity_type_check
  check (entity_type in ('individual','sole_prop','llc','llc_s_corp','llc_c_corp','s_corp','c_corp','partnership'));
alter table public.contractors
  add column if not exists agreement_signed_for text,
  add column if not exists agreement_signer_title text;
alter table public.contract_acceptances
  add column if not exists on_behalf_of text,
  add column if not exists signer_title text;


-- ============================================================================
-- PART 4 of 5: RUN_ONCE_ALL_NEW_2026-10-21_0000.sql
-- ============================================================================

-- ============================================================================
-- FILE    : supabase/setup/RUN_ONCE_ALL_NEW_2026-10-21_0000.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-10-21_0000 UTC
-- PURPOSE : ONE paste for the EXISTING Supabase project — every database change from 2026-10-19 to 2026-10-21, in order:
--             1. SAM.gov contract awards          (ADD_GOV_CONTRACT_AWARDS_2026-10-19_2015.sql)
--             2. Subcontracting + focus trades    (ADD_GOV_SUBCONTRACTING_2026-10-19_2140.sql)
--             3. Instantly → CRM sync             (ADD_INSTANTLY_CRM_SYNC_2026-10-19_2230.sql)
--             4. AI bid desk: 5 gov bids a day    (ADD_GOV_DAILY_PICKS_2026-10-19_2330.sql)
--             5. Call desk                        (ADD_CALL_DESK_2026-10-20_0015.sql)
--             6. Omnichannel: lead inbox, social  (ADD_OMNICHANNEL_2026-10-20_0100.sql)
--             7. Pro marketplace + quotes         (ADD_PRO_MARKETPLACE_2026-10-20_0200.sql)
--           Supabase -> SQL Editor -> New query -> paste this whole file -> Run. Safe to run twice.
-- ============================================================================

-- 1. ADD_GOV_CONTRACT_AWARDS_2026-10-19_2015 ─────────────────────────────────────────────
create table if not exists public.gov_awards (
  award_key text primary key,
  piid text not null,
  referenced_idv_piid text,
  modification_number text,
  agency text,
  subtier text,
  office text,
  awardee text,
  awardee_uei text,
  awardee_city text,
  awardee_state text,
  naics text,
  naics_title text,
  psc text,
  psc_title text,
  set_aside_code text,
  set_aside text,
  description text,
  solicitation_id text,
  offers_received int,
  date_signed date,
  pop_start date,
  current_end date,
  ultimate_end date,
  obligated numeric,
  total_value numeric,
  pop_city text,
  pop_state text,
  pop_zip text,
  fit_score int not null default 0,
  fit jsonb,
  services text[] not null default '{}'::text[],
  status text not null default 'new' check (status in ('new','watching','ignored')),
  notes text,
  raw jsonb,
  first_seen timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gov_awards_fit on public.gov_awards (status, fit_score desc);
create index if not exists gov_awards_end on public.gov_awards (ultimate_end);
create index if not exists gov_awards_awardee on public.gov_awards (awardee_uei);
alter table public.gov_awards enable row level security;
drop policy if exists staff_all on public.gov_awards;
create policy staff_all on public.gov_awards for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.gov_settings add column if not exists awards_enabled boolean not null default false;
alter table public.gov_settings add column if not exists awards_months_back int not null default 24 check (awards_months_back between 1 and 60);
alter table public.gov_settings add column if not exists awards_pages int not null default 2 check (awards_pages between 1 and 20);

alter table public.gov_api_calls drop constraint if exists gov_api_calls_kind_check;
alter table public.gov_api_calls add constraint gov_api_calls_kind_check check (kind in ('search','description','awards'));

-- 2. ADD_GOV_SUBCONTRACTING_2026-10-19_2140 ─────────────────────────────────────────────
alter table public.gov_awards add column if not exists awardee_phone text;
alter table public.gov_awards add column if not exists awardee_address text;
alter table public.gov_awards add column if not exists awardee_size text;
alter table public.gov_awards add column if not exists subcontract_plan text;
alter table public.gov_awards add column if not exists sub_score int not null default 0;
alter table public.gov_awards add column if not exists sub_fit jsonb;
create index if not exists gov_awards_sub on public.gov_awards (sub_score desc);

alter table public.gov_settings add column if not exists awards_naics text[] not null default array['561730','238320','541511','541512','541519','238150','561740','236220','236118']::text[];
update public.gov_settings set naics = array['561730','238320','541511','541512','541519','238150','561740','236220','236118']::text[]
  where naics = array['561720','561730','561790','561612','562111','484210']::text[];

-- 3. ADD_INSTANTLY_CRM_SYNC_2026-10-19_2230 ─────────────────────────────────────────────
alter table public.biz_leads drop constraint if exists biz_leads_source_check;
alter table public.biz_leads add constraint biz_leads_source_check check (source in ('google_places','csv','manual','job_board','instantly'));

-- 4. ADD_GOV_DAILY_PICKS_2026-10-19_2330 ─────────────────────────────────────────────
alter table public.gov_settings add column if not exists daily_picks int not null default 5 check (daily_picks between 0 and 20);
alter table public.gov_opportunities add column if not exists picked_at timestamptz;
create index if not exists gov_opportunities_picked on public.gov_opportunities (picked_at);
update public.gov_settings set daily_call_budget = 10 where daily_call_budget = 8;

-- 5. ADD_CALL_DESK_2026-10-20_0015 ─────────────────────────────────────────────
alter table public.biz_leads add column if not exists next_call_at timestamptz;
alter table public.biz_leads add column if not exists call_attempts int not null default 0;
alter table public.biz_leads add column if not exists last_call_outcome text;
alter table public.biz_leads add column if not exists last_called_at timestamptz;
create index if not exists biz_leads_next_call on public.biz_leads (next_call_at);
alter table public.biz_lead_settings add column if not exists call_goal int not null default 30 check (call_goal between 0 and 500);

-- 6. ADD_OMNICHANNEL_2026-10-20_0100 ─────────────────────────────────────────────
alter table public.leads add column if not exists channel text not null default 'website';
alter table public.leads add column if not exists company text;
alter table public.leads add column if not exists city text;
alter table public.leads add column if not exists campaign text;
alter table public.leads add column if not exists attribution jsonb;
alter table public.leads add column if not exists status text not null default 'new';
alter table public.leads add column if not exists sms_consent boolean not null default false;
alter table public.leads add column if not exists external_id text;
alter table public.leads add column if not exists first_reply_at timestamptz;
alter table public.leads add column if not exists contacted_at timestamptz;
alter table public.leads add column if not exists handled_by text;
alter table public.leads add column if not exists biz_lead_id uuid references public.biz_leads(id) on delete set null;
alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check check (status in ('new','contacted','booked','lost','spam'));
create unique index if not exists leads_channel_external on public.leads (channel, external_id) where external_id is not null;
create index if not exists leads_status_created on public.leads (status, created_at desc);
create index if not exists leads_channel_created on public.leads (channel, created_at desc);

-- inbound business leads land in the CRM too (source 'inbound'), at the top of the Call desk
alter table public.biz_leads drop constraint if exists biz_leads_source_check;
alter table public.biz_leads add constraint biz_leads_source_check check (source in ('google_places','csv','manual','job_board','instantly','inbound'));

create table if not exists public.social_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  auto_publish boolean not null default false,
  per_week jsonb not null default '{"facebook":3,"instagram":3,"tiktok":2}'::jsonb,
  themes text,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.social_settings enable row level security;
drop policy if exists staff_all on public.social_settings;
create policy staff_all on public.social_settings for all to authenticated using (public.is_staff()) with check (public.is_staff());
insert into public.social_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('facebook','instagram','tiktok')),
  scheduled_for timestamptz not null,
  status text not null default 'draft' check (status in ('draft','approved','posted','failed','skipped')),
  caption text not null,
  hashtags text[] not null default '{}'::text[],
  media_idea text,
  media_url text,
  service_slug text,
  external_id text,
  error text,
  created_by text not null default 'AI social writer',
  approved_by text,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists social_posts_when on public.social_posts (status, scheduled_for);
alter table public.social_posts enable row level security;
drop policy if exists staff_all on public.social_posts;
create policy staff_all on public.social_posts for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- 7. ADD_PRO_MARKETPLACE_2026-10-20_0200 ─────────────────────────────────────────────
create table if not exists public.pro_rates (
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  service_slug text not null,
  pct int not null check (pct between 80 and 175),
  min_job numeric check (min_job is null or min_job between 0 and 100000),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (contractor_id, service_slug)
);
create index if not exists pro_rates_service on public.pro_rates (service_slug) where active;
alter table public.pro_rates enable row level security;
drop policy if exists staff_all on public.pro_rates;
create policy staff_all on public.pro_rates for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.jobs add column if not exists priced_by text check (priced_by is null or priced_by in ('engine','offer','pro_rate','quote'));
alter table public.jobs add column if not exists pro_rate_pct int;

create table if not exists public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 24),
  customer_id uuid references public.profiles(id) on delete set null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  service_slug text not null,
  description text not null,
  zip text not null,
  city text,
  preferred_date date,
  photos text[] not null default '{}'::text[],
  status text not null default 'open' check (status in ('open','quoted','booked','expired','cancelled')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  job_id uuid references public.jobs(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists quote_requests_status on public.quote_requests (status, created_at desc);
alter table public.quote_requests enable row level security;
drop policy if exists staff_all on public.quote_requests;
create policy staff_all on public.quote_requests for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.quote_bids (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.quote_requests(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  token text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 24),
  status text not null default 'invited' check (status in ('invited','quoted','declined','expired','chosen','lost')),
  pay numeric check (pay is null or pay > 0),
  price numeric check (price is null or price > 0),
  earliest_date date,
  note text,
  invited_at timestamptz not null default now(),
  quoted_at timestamptz,
  unique (request_id, contractor_id)
);
create index if not exists quote_bids_request on public.quote_bids (request_id);
alter table public.quote_bids enable row level security;
drop policy if exists staff_all on public.quote_bids;
create policy staff_all on public.quote_bids for all to authenticated using (public.is_staff()) with check (public.is_staff());


-- ============================================================================
-- PART 5 of 5: ADD_RECRUITING_INTAKE_2026-10-23_1100.sql
-- ============================================================================

-- ============================================================================
-- FILE    : supabase/setup/ADD_RECRUITING_INTAKE_2026-10-23_1100.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-23_1100 UTC
-- PURPOSE : ONE paste for the existing Supabase project (Supabase -> SQL Editor -> New query -> paste -> Run).
--           Candidates from outside the /pros form — Indeed Apply, CSV imports, staff adding someone by hand:
--             • contractor_applications.external_source / external_id — the ATS and its application id
--               (unique together, so a re-delivered Indeed application is never added twice)
--             • external_job  — the job they applied to (id, title, location, jobMeta, url)
--             • screener      — screener-question answers as sent
--             • resume_path   — résumé file in the private pro-docs bucket (applications/<id>/…)
--             • added_by      — the staff member who added or imported them
--           Safe to run twice.
-- ============================================================================
alter table public.contractor_applications
  add column if not exists external_source text,
  add column if not exists external_id text,
  add column if not exists external_job jsonb,
  add column if not exists screener jsonb,
  add column if not exists resume_path text,
  add column if not exists added_by text;

create unique index if not exists contractor_applications_external_uidx
  on public.contractor_applications (external_source, external_id) where external_id is not null;


-- ============================================================================
-- PART 2 of 3: ADD_RECRUITING_DIVISION_2026-10-27_1700.sql
-- ============================================================================

-- ============================================================================
-- FILE    : supabase/setup/ADD_RECRUITING_DIVISION_2026-10-27_1700.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-27_1700 UTC
-- PURPOSE : ONE paste for the existing Supabase project (Supabase -> SQL Editor -> New query -> paste -> Run).
--           The Recruiting division (Hub → Recruiting): one place for every role we fill.
--             • talent_clients.internal — Handled itself as a Talent "client", so our own staff roles run through the
--               same pipeline as client searches (no fees: fee_pct may be 0 for internal searches)
--             • talent_searches.public — listed on the public /careers page (applicants apply there or from Indeed)
--             • talent_searches.indeed_url / indeed_posted_at — where the role is posted on Indeed
--             • recruiting_postings — Indeed posting status for openings that aren't searches (independent-pro trades,
--               key "pro:<trade>")
--             • the internal client row: "Handled Services LLC (our team)"
--           Safe to run twice.
-- ============================================================================
alter table public.talent_clients add column if not exists internal boolean not null default false;

alter table public.talent_searches drop constraint if exists talent_searches_fee_pct_check;
alter table public.talent_searches add constraint talent_searches_fee_pct_check check (fee_pct >= 0 and fee_pct <= 50);
alter table public.talent_searches add column if not exists public boolean not null default false;
alter table public.talent_searches add column if not exists indeed_url text;
alter table public.talent_searches add column if not exists indeed_posted_at timestamptz;

create table if not exists public.recruiting_postings (
  opening_key text primary key,
  indeed_url text,
  posted_at timestamptz,
  paused boolean not null default false,
  notes text,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.recruiting_postings enable row level security;
drop policy if exists staff_all on public.recruiting_postings;
create policy staff_all on public.recruiting_postings for all to authenticated using (public.is_staff()) with check (public.is_staff());

insert into public.talent_clients (company, contact_name, email, status, internal, created_by, notes)
select 'Handled Services LLC (our team)', 'Handled hiring', 'info@handledsvc.com', 'active', true, 'migration', 'Internal: our own staff roles. No fees.'
where not exists (select 1 from public.talent_clients where internal);


-- ============================================================================
-- PART 3 of 3: ADD_PARTNER_TICKETS_2026-10-28_0122.sql
-- ============================================================================

-- ============================================================================
-- FILE    : supabase/setup/ADD_PARTNER_TICKETS_2026-10-28_0122.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-10-28_0122 UTC
-- PURPOSE : ONE paste for the EXISTING Supabase project: Referral Partner Program v2 — fixed earnings tiers
--           (25% one-time / 10% repeat / 15% account, split 50/50 pro and Handled) and the standard referral ticket.
--           Same as migration 20261028012200_partner_tickets_tiers.sql. Needs the Partner Program tables
--           (ADD_REFERRAL_PARTNERS_2026-10-07_0100.sql, already in the full setup).
--           Safe to run twice. Supabase -> SQL Editor -> New query -> paste this whole file -> Run.
-- ============================================================================
alter table public.referral_customers add column if not exists ticket_no text;
alter table public.referral_customers add column if not exists job_type text;
alter table public.referral_customers add column if not exists address text;
alter table public.referral_customers add column if not exists city text;
alter table public.referral_customers add column if not exists zip text;
alter table public.referral_customers add column if not exists company text;
alter table public.referral_customers add column if not exists contact_pref text;
alter table public.referral_customers add column if not exists best_time text;
alter table public.referral_customers add column if not exists timing text;
alter table public.referral_customers add column if not exists preferred_date date;
alter table public.referral_customers add column if not exists details text;
alter table public.referral_customers add column if not exists relationship text;
alter table public.referral_customers add column if not exists consent_at timestamptz;
alter table public.referral_customers add column if not exists status text not null default 'submitted';
alter table public.referral_customers add column if not exists staff_note text;
alter table public.referral_customers add column if not exists updated_at timestamptz not null default now();
alter table public.referral_customers drop constraint if exists referral_customers_status_check;
alter table public.referral_customers add constraint referral_customers_status_check check (status in ('submitted','contacted','closed'));
alter table public.referral_customers drop constraint if exists referral_customers_job_type_check;
alter table public.referral_customers add constraint referral_customers_job_type_check check (job_type is null or job_type in ('one_time','recurring','account'));
create unique index if not exists referral_customers_ticket_no_idx on public.referral_customers (ticket_no) where ticket_no is not null;

alter table public.partner_commissions add column if not exists tier text;
alter table public.partner_commissions add column if not exists rate numeric(5,4);
alter table public.partner_commissions add column if not exists from_pro numeric(12,2) not null default 0;
alter table public.partner_commissions add column if not exists from_us numeric(12,2) not null default 0;
alter table public.partner_commissions add column if not exists pro_returned numeric(12,2) not null default 0;
alter table public.partner_commissions drop constraint if exists partner_commissions_tier_check;
alter table public.partner_commissions add constraint partner_commissions_tier_check check (tier is null or tier in ('one_time','repeat','account','legacy'));

alter table public.jobs add column if not exists partner_tier text;
alter table public.jobs add column if not exists partner_pro_fee numeric(12,2) not null default 0;
alter table public.jobs drop constraint if exists jobs_partner_tier_check;
alter table public.jobs add constraint jobs_partner_tier_check check (partner_tier is null or partner_tier in ('one_time','repeat','account'));

alter table public.payouts drop constraint if exists payouts_kind_check;
alter table public.payouts add constraint payouts_kind_check
  check (kind in ('job','show_up','guarantee','stipend','materials','clawback','referral','tip','placement','partner_fee'));

