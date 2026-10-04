-- ============================================================================
-- FILE    : supabase/migrations/20261004193200_business_growth.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-04_1932 UTC
-- PURPOSE : The growth plan's missing pieces:
--             • markets.launch_services   — constraint-driven launch: only these services are bookable in
--                                           the city (null = all); others show "coming soon" + waitlist
--             • business accounts         — billing (prepay by default; invoicing on terms approved case by
--                                           case with a credit limit and a reason; automatic hold when an
--                                           invoice is 10+ days overdue), priority dispatch, pilot offer,
--                                           members (logins), properties, dedicated pros, monthly invoices
--             • jobs.business_*           — account bookings: property, billed on the account's invoice
--             • biz_leads (+ events, settings) — the business sales engine (property managers, brokerages,
--                                           stagers, self-storage, stores)
--             • contractors.id_verified_at — photo ID matched to a selfie (Stripe Identity) or a staff video call
-- ============================================================================

-- ── Launch set per city ─────────────────────────────────────────────────────
alter table public.markets add column if not exists launch_services text[];

-- ── Business accounts ───────────────────────────────────────────────────────
alter table public.business_accounts
  add column if not exists billing_mode text not null default 'prepay' check (billing_mode in ('prepay','terms')),
  add column if not exists terms_days int not null default 30 check (terms_days in (15,30,45)),
  add column if not exists credit_limit numeric(12,2) not null default 0 check (credit_limit >= 0),
  add column if not exists terms_hold boolean not null default false,
  add column if not exists terms_approved_by text,
  add column if not exists terms_approved_at timestamptz,
  add column if not exists terms_note text,
  add column if not exists terms_requested_at timestamptz,
  add column if not exists priority boolean not null default false,
  add column if not exists pilot_discount_pct int not null default 0 check (pilot_discount_pct between 0 and 30),
  add column if not exists pilot_jobs_left int not null default 0 check (pilot_jobs_left between 0 and 5),
  add column if not exists billing_email text,
  add column if not exists industry text,
  add column if not exists source_lead_id uuid;
comment on column public.business_accounts.billing_terms is 'Legacy (unused): see billing_mode / terms_days. Every account starts on prepay.';

create table if not exists public.business_members (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.business_accounts(id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  profile_id uuid references public.profiles(id) on delete set null,
  role text not null default 'booker' check (role in ('admin','booker')),
  created_at timestamptz not null default now(),
  unique (account_id, email)
);
create index if not exists business_members_profile_idx on public.business_members (profile_id);
create index if not exists business_members_email_idx on public.business_members (email);

create table if not exists public.business_properties (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.business_accounts(id) on delete cascade,
  name text not null,
  address text not null,
  city text not null,
  state text not null,
  zip text not null check (zip ~ '^\d{5}$'),
  units int check (units is null or units >= 0),
  access_notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists business_properties_account_idx on public.business_properties (account_id);

create table if not exists public.business_pros (
  account_id uuid not null references public.business_accounts(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  added_by text,
  created_at timestamptz not null default now(),
  primary key (account_id, contractor_id)
);

create table if not exists public.business_invoices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.business_accounts(id) on delete cascade,
  number text not null unique,
  period_start date not null,
  period_end date not null,
  issued_on date not null,
  due_date date not null,
  total numeric(12,2) not null check (total >= 0),
  amount_paid numeric(12,2) not null default 0,
  status text not null default 'open' check (status in ('open','paid','void')),
  paid_at timestamptz,
  payment_url text,
  reminders_sent int not null default 0,
  last_reminder_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists business_invoices_open_idx on public.business_invoices (status, due_date);

alter table public.jobs
  add column if not exists business_property_id uuid references public.business_properties(id) on delete set null,
  add column if not exists billed_on_terms boolean not null default false,
  add column if not exists business_invoice_id uuid references public.business_invoices(id) on delete set null;
create index if not exists jobs_business_idx on public.jobs (business_account_id) where business_account_id is not null;
create index if not exists jobs_terms_uninvoiced_idx on public.jobs (business_account_id) where billed_on_terms and business_invoice_id is null;

alter table public.payments add column if not exists business_invoice_id uuid references public.business_invoices(id) on delete set null;
alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check
  check (kind in ('deposit','final','milestone','plan','upfront','refund','balance','change_order','offer_raise','custom','materials','tip','gift_card','membership','invoice'));

-- dedicated pros get a first-look offer on their account's jobs
alter table public.job_offers drop constraint if exists job_offers_kind_check;
alter table public.job_offers add constraint job_offers_kind_check check (kind in ('job','recurring','redo','account'));

-- RLS: staff everything; members read their own accounts (portal pages use the server with membership checks)
alter table public.business_members enable row level security;
alter table public.business_properties enable row level security;
alter table public.business_pros enable row level security;
alter table public.business_invoices enable row level security;
create policy staff_all on public.business_members for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.business_properties for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.business_pros for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.business_invoices for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "members read own membership" on public.business_members for select using (profile_id = auth.uid());
create policy "members read own properties" on public.business_properties for select using (
  account_id in (select account_id from public.business_members where profile_id = auth.uid()));
create policy "members read own invoices" on public.business_invoices for select using (
  account_id in (select account_id from public.business_members where profile_id = auth.uid()));
create policy "members read own account" on public.business_accounts for select using (
  id in (select account_id from public.business_members where profile_id = auth.uid()));

-- ── Business sales engine ───────────────────────────────────────────────────
create table if not exists public.biz_leads (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 18),
  source text not null check (source in ('google_places','csv','manual')),
  external_id text,
  business_name text not null,
  segment text not null check (segment in ('property_manager','real_estate','stager','storage','retail')),
  contact_name text,
  city text,
  zip text,
  phone text,
  email text,
  website text,
  rating numeric(2,1),
  review_count int,
  score int not null default 0,
  status text not null default 'new' check (status in ('new','queued','emailing','clicked','replied','converted','call','not_interested','unsubscribed','bounced','do_not_contact')),
  account_id uuid references public.business_accounts(id) on delete set null,
  last_contact_at timestamptz,
  details_expire_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (source, external_id)
);
alter table public.biz_leads enable row level security; -- server / staff only
create index if not exists biz_leads_status_idx on public.biz_leads (status, score desc);
create index if not exists biz_leads_email_idx on public.biz_leads (lower(email));

create table if not exists public.biz_lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.biz_leads(id) on delete cascade,
  kind text not null,
  note text,
  actor text,
  created_at timestamptz not null default now()
);
alter table public.biz_lead_events enable row level security;

create table if not exists public.biz_lead_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  discover_per_day int not null default 5,
  emails_per_day int not null default 20,
  segments text[] not null default '{property_manager,real_estate,stager,storage}',
  pilot_pct int not null default 20 check (pilot_pct between 0 and 30),
  pilot_jobs int not null default 2 check (pilot_jobs between 0 and 5),
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.biz_lead_settings enable row level security;
insert into public.biz_lead_settings (id) values (1) on conflict do nothing;

alter table public.business_accounts drop constraint if exists business_accounts_source_lead_fk;
alter table public.business_accounts add constraint business_accounts_source_lead_fk foreign key (source_lead_id) references public.biz_leads(id) on delete set null;

-- ── Pro photo ID verification ───────────────────────────────────────────────
alter table public.contractors
  add column if not exists id_verified_at timestamptz,
  add column if not exists id_verification jsonb;
-- pros already approved before this step existed keep working (verified by the earlier process)
update public.contractors set id_verified_at = coalesce(background_checked_at, onboarded_at, now()), id_verification = '{"provider":"grandfathered"}'
  where status = 'approved' and id_verified_at is null;
