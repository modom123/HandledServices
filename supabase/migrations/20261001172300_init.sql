-- ============================================================================
-- FILE    : supabase/migrations/20261001172300_init.sql
-- PROJECT : Handled — AI-run home & business services
-- CREATED : 2026-10-01_1723 UTC
-- PURPOSE : Core schema: profiles & roles, service catalog, markets, contractors and
--           applications, jobs with offers/events/messages, payments & payouts,
--           recurring plans, business accounts, AI run log and ops alerts.
--           Row-level security on every table. Writes that cross trust boundaries
--           (public bookings, pro job actions, dispatch) go through the Next.js API
--           with the service-role key after server-side authorization checks.
-- ============================================================================


-- ─── Enums ──────────────────────────────────────────────────────────────────
create type app_role as enum ('customer', 'pro', 'dispatcher', 'admin');
create type job_status as enum ('requested','site_visit','quoted','scheduled','dispatched','assigned','in_progress','qa_review','completed','cancelled');
create type offer_status as enum ('offered','accepted','declined','expired');
create type contractor_status as enum ('applied','vetting','approved','suspended');
create type customer_type as enum ('residential','commercial');
create type time_window as enum ('morning','midday','afternoon','flexible');
create type frequency as enum ('once','weekly','biweekly','monthly','quarterly');
create type job_priority as enum ('normal','high','urgent');
create type job_source as enum ('web','mobile','business','phone','ai_chat');

-- ─── Helpers ────────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ─── Profiles ───────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role app_role not null default 'customer',
  full_name text,
  email text,
  phone text,
  company text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  -- link guest bookings made with this email before the account existed
  update public.jobs set customer_id = new.id where customer_id is null and lower(contact_email) = lower(new.email);
  -- link an approved contractor record with this email
  update public.contractors set profile_id = new.id where profile_id is null and lower(email) = lower(new.email);
  update public.profiles set role = 'pro' where id = new.id and exists (select 1 from public.contractors where profile_id = new.id);
  return new;
end $$;

create or replace function public.app_role() returns app_role
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'customer'::app_role)
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.app_role() in ('dispatcher','admin')
$$;

-- ─── Catalog & markets ──────────────────────────────────────────────────────
create table public.services (
  slug text primary key,
  name text not null,
  category text not null,
  active boolean not null default true,
  minimum numeric(10,2) not null,
  payout_share numeric(4,3) not null,
  site_visit boolean not null default false,
  price_multiplier numeric(5,3) not null default 1.0,
  sort int not null default 0
);

create table public.markets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state text not null,
  zip_prefixes text[] not null default '{}',
  price_multiplier numeric(5,3) not null default 1.0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─── Contractors (subcontracted pros) ───────────────────────────────────────
create table public.contractors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  business_name text not null,
  contact_name text not null,
  email text not null unique,
  phone text not null,
  trades text[] not null default '{}',
  service_zips text[] not null default '{}',
  status contractor_status not null default 'vetting',
  rating numeric(2,1) not null default 5.0,
  jobs_completed int not null default 0,
  acceptance_rate numeric(4,3) not null default 1.0,
  on_time_rate numeric(4,3) not null default 1.0,
  insured_until date,
  license_number text,
  background_checked boolean not null default false,
  daily_capacity int not null default 3,
  stripe_account_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger contractors_touch before update on public.contractors for each row execute function public.touch_updated_at();

create or replace function public.my_contractor_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.contractors where profile_id = auth.uid()
$$;

create table public.contractor_applications (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text not null,
  email text not null,
  phone text not null,
  trades text[] not null default '{}',
  zips text,
  years_experience int,
  crew_size int,
  insured boolean not null default false,
  license_number text,
  has_vehicle boolean not null default true,
  message text,
  status text not null default 'new' check (status in ('new','reviewing','approved','rejected')),
  ai_screen jsonb,
  created_at timestamptz not null default now()
);

-- ─── Business (commercial) accounts ─────────────────────────────────────────
create table public.business_accounts (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  contact_name text not null,
  email text not null,
  phone text,
  locations int not null default 1,
  services_needed text[] not null default '{}',
  billing_terms text not null default 'net15',
  status text not null default 'lead' check (status in ('lead','proposal','active','paused','lost')),
  monthly_value numeric(10,2),
  notes text,
  owner_profile_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ─── Jobs ───────────────────────────────────────────────────────────────────
create sequence public.job_ref_seq start 1001;

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('H-' || nextval('public.job_ref_seq')::text),
  status job_status not null default 'requested',
  service_slug text not null references public.services(slug),
  customer_id uuid references public.profiles(id) on delete set null,
  business_account_id uuid references public.business_accounts(id) on delete set null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  customer_type customer_type not null default 'residential',
  company_name text,
  address text not null,
  city text not null,
  state text not null,
  zip text not null,
  answers jsonb not null default '{}',
  notes text,
  photos text[] not null default '{}',
  completion_photos text[] not null default '{}',
  frequency frequency not null default 'once',
  scheduled_date date,
  time_window time_window not null default 'flexible',
  estimate_low numeric(10,2) not null,
  estimate_high numeric(10,2) not null,
  price_final numeric(10,2),
  contractor_id uuid references public.contractors(id) on delete set null,
  contractor_payout numeric(10,2),
  ai_quote jsonb,
  ai_dispatch jsonb,
  ai_qa jsonb,
  priority job_priority not null default 'normal',
  source job_source not null default 'web',
  plan_id uuid,
  stripe_customer_id text,
  stripe_payment_method text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_status_idx on public.jobs(status);
create index jobs_contractor_idx on public.jobs(contractor_id);
create index jobs_customer_idx on public.jobs(customer_id);
create index jobs_date_idx on public.jobs(scheduled_date);
create trigger jobs_touch before update on public.jobs for each row execute function public.touch_updated_at();

create table public.job_offers (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  status offer_status not null default 'offered',
  payout numeric(10,2) not null,
  ai_score numeric(5,1),
  ai_reason text,
  offered_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 hours',
  responded_at timestamptz,
  unique (job_id, contractor_id)
);
create index job_offers_contractor_idx on public.job_offers(contractor_id, status);

create table public.job_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.jobs(id) on delete cascade,
  kind text not null,
  message text not null,
  actor text not null default 'system',
  visible_to_customer boolean not null default true,
  created_at timestamptz not null default now()
);
create index job_events_job_idx on public.job_events(job_id, created_at);

-- Every status change is written to the job timeline automatically.
create or replace function public.log_job_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.job_events(job_id, kind, message) values (new.id, 'created', 'Booking received — ref ' || new.ref);
  elsif new.status is distinct from old.status then
    insert into public.job_events(job_id, kind, message)
    values (new.id, 'status', 'Status: ' || old.status || ' → ' || new.status);
  end if;
  return new;
end $$;
create trigger jobs_status_log after insert or update of status on public.jobs for each row execute function public.log_job_status();

create table public.messages (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.jobs(id) on delete cascade,
  sender_id uuid references public.profiles(id),
  sender_role text not null check (sender_role in ('customer','pro','ops','ai')),
  body text not null,
  created_at timestamptz not null default now()
);
create index messages_job_idx on public.messages(job_id, created_at);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  contractor_id uuid references public.contractors(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

-- ─── Money ──────────────────────────────────────────────────────────────────
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  kind text not null default 'final' check (kind in ('deposit','final','milestone','plan')),
  amount numeric(10,2) not null,
  status text not null default 'pending' check (status in ('pending','paid','refunded','failed')),
  stripe_session_id text,
  created_at timestamptz not null default now()
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  amount numeric(10,2) not null,
  status text not null default 'pending' check (status in ('pending','approved','paid','held')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.recurring_plans (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id) on delete set null,
  source_job_id uuid references public.jobs(id) on delete set null,
  service_slug text not null references public.services(slug),
  frequency frequency not null,
  price numeric(10,2) not null,
  next_date date not null,
  preferred_contractor_id uuid references public.contractors(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.jobs add constraint jobs_plan_fk foreign key (plan_id) references public.recurring_plans(id) on delete set null;

-- ─── AI + ops ───────────────────────────────────────────────────────────────
create table public.ai_runs (
  id bigint generated always as identity primary key,
  kind text not null,
  job_id uuid references public.jobs(id) on delete set null,
  model text,
  input jsonb,
  output jsonb,
  input_tokens int,
  output_tokens int,
  ok boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.ops_alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  severity text not null default 'info' check (severity in ('info','warn','critical')),
  title text not null,
  body text,
  job_id uuid references public.jobs(id) on delete cascade,
  contractor_id uuid references public.contractors(id) on delete cascade,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  phone text,
  zip text,
  service_slug text,
  message text,
  source text not null default 'web',
  created_at timestamptz not null default now()
);

-- auth trigger is created last because handle_new_user() touches jobs/contractors
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ─── Row-level security ─────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.markets enable row level security;
alter table public.contractors enable row level security;
alter table public.contractor_applications enable row level security;
alter table public.business_accounts enable row level security;
alter table public.jobs enable row level security;
alter table public.job_offers enable row level security;
alter table public.job_events enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;
alter table public.payments enable row level security;
alter table public.payouts enable row level security;
alter table public.recurring_plans enable row level security;
alter table public.ai_runs enable row level security;
alter table public.ops_alerts enable row level security;
alter table public.leads enable row level security;

-- staff (dispatcher/admin) can do everything on every table
do $$
declare t text;
begin
  foreach t in array array['profiles','services','markets','contractors','contractor_applications','business_accounts','jobs',
    'job_offers','job_events','messages','reviews','payments','payouts','recurring_plans','ai_runs','ops_alerts','leads']
  loop
    execute format('create policy staff_all on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t);
  end loop;
end $$;

-- profiles: read/update self (role changes are blocked by the column grant below)
create policy profile_self_read on public.profiles for select to authenticated using (id = auth.uid());
create policy profile_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (full_name, phone, company) on public.profiles to authenticated;

-- catalog is public
create policy services_public on public.services for select using (true);
create policy markets_public on public.markets for select using (active);
create policy reviews_public on public.reviews for select using (true);

-- contractors: a pro sees their own record
create policy contractor_self on public.contractors for select to authenticated using (profile_id = auth.uid());

-- jobs: customers see their own; pros see assigned jobs and jobs offered to them
create policy jobs_customer on public.jobs for select to authenticated using (customer_id = auth.uid());
create policy jobs_pro on public.jobs for select to authenticated using (
  contractor_id = public.my_contractor_id()
  or exists (select 1 from public.job_offers o where o.job_id = jobs.id and o.contractor_id = public.my_contractor_id() and o.status = 'offered')
);

create policy offers_pro on public.job_offers for select to authenticated using (contractor_id = public.my_contractor_id());

create policy events_customer on public.job_events for select to authenticated using (
  visible_to_customer and exists (select 1 from public.jobs j where j.id = job_id and j.customer_id = auth.uid())
);
create policy events_pro on public.job_events for select to authenticated using (
  exists (select 1 from public.jobs j where j.id = job_id and j.contractor_id = public.my_contractor_id())
);

-- messages: the customer and the assigned pro on a job can read & post
create policy messages_party_read on public.messages for select to authenticated using (
  exists (select 1 from public.jobs j where j.id = job_id and (j.customer_id = auth.uid() or j.contractor_id = public.my_contractor_id()))
);
create policy messages_customer_post on public.messages for insert to authenticated with check (
  sender_id = auth.uid() and sender_role = 'customer'
  and exists (select 1 from public.jobs j where j.id = job_id and j.customer_id = auth.uid())
);
create policy messages_pro_post on public.messages for insert to authenticated with check (
  sender_id = auth.uid() and sender_role = 'pro'
  and exists (select 1 from public.jobs j where j.id = job_id and j.contractor_id = public.my_contractor_id())
);

create policy reviews_customer_post on public.reviews for insert to authenticated with check (
  exists (select 1 from public.jobs j where j.id = job_id and j.customer_id = auth.uid() and j.status = 'completed')
);

create policy payments_customer on public.payments for select to authenticated using (
  exists (select 1 from public.jobs j where j.id = job_id and j.customer_id = auth.uid())
);
create policy payouts_pro on public.payouts for select to authenticated using (contractor_id = public.my_contractor_id());
create policy plans_customer on public.recurring_plans for select to authenticated using (customer_id = auth.uid());

-- ─── Storage: private bucket for job photos ─────────────────────────────────
insert into storage.buckets (id, name, public) values ('job-photos', 'job-photos', false) on conflict (id) do nothing;
create policy job_photos_staff on storage.objects for all to authenticated
  using (bucket_id = 'job-photos' and public.is_staff()) with check (bucket_id = 'job-photos' and public.is_staff());

-- ─── Realtime ───────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.jobs, public.job_offers, public.job_events, public.messages, public.ops_alerts;
