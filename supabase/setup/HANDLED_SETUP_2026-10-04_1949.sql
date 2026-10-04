-- ============================================================================
-- FILE    : supabase/setup/HANDLED_SETUP_2026-10-04_1949.sql   (generated — do not hand edit)
-- PROJECT : Handled (myhumanai)
-- CREATED : 2026-10-04_1949 UTC
-- PURPOSE : One-paste setup for a NEW Supabase project: 30 migrations + production seed.
--           Supabase → SQL Editor → New query → paste this whole file → Run.
--           Then sign in once on the website and run:
--             update public.profiles set role = 'admin' where email = 'YOU@YOURCOMPANY.COM';
-- ============================================================================


-- >>> migration 20261001172300_init.sql
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


-- >>> migration 20261001180000_iebc_workforce.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261001180000_iebc_workforce.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-01_1800 UTC
-- PURPOSE : IEBC Workforce integration. IEBC's AI employees (from the IEBC MasterHub
--           workforce roster) are assigned to departments of this business. Each
--           assignment lists the scopes the agent may use and an autonomy level:
--             suggest     — every write is a proposal a human must approve
--             approval    — same as suggest, labeled as delegated work awaiting sign-off
--             autonomous  — low-risk writes run immediately; high-risk still need approval
--           Every call is recorded in agent_actions (the audit log + approval queue).
-- ============================================================================

create table public.iebc_agents (
  id uuid primary key default gen_random_uuid(),
  iebc_employee_id text not null unique,   -- matches the id in the MasterHub workforce roster
  name text not null,
  title text not null,
  iebc_dept text not null,
  role_here text not null,                 -- what they run for this business
  scopes text[] not null default '{}',
  autonomy text not null default 'approval' check (autonomy in ('suggest','approval','autonomous')),
  active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.iebc_agents(id) on delete set null,
  action text not null,
  params jsonb not null default '{}',
  reason text,                             -- the agent's stated rationale
  status text not null check (status in ('executed','pending_approval','rejected','failed','denied')),
  result jsonb,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index agent_actions_status_idx on public.agent_actions(status, created_at desc);

alter table public.iebc_agents enable row level security;
alter table public.agent_actions enable row level security;
create policy staff_all on public.iebc_agents for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.agent_actions for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter publication supabase_realtime add table public.agent_actions;

-- Default staffing plan — edit in the Command Center → IEBC Workforce.
insert into public.iebc_agents (iebc_employee_id, name, title, iebc_dept, role_here, scopes, autonomy) values
  ('evelyn',   'Dr. Evelyn Sterling', 'Chief Operating Officer',     'Operations', 'Executive oversight & escalations',
     array['read'], 'suggest'),
  ('arthur',   'Arthur Vance',        'VP Global Operations',        'Operations', 'Dispatch & daily operations',
     array['read','ops'], 'autonomous'),
  ('katerina', 'Katerina Rostova',    'Head of Process Auto',        'Operations', 'Pipeline hygiene & stuck-job sweeps',
     array['read','ops'], 'approval'),
  ('eleanor',  'Eleanor Wei',         'Chief Financial Officer',     'Finance',    'Unit economics, pricing & payouts',
     array['read','finance'], 'approval'),
  ('tylerw',   'Tyler Walsh',         'VP Talent Acquisition',       'Recruiting', 'Subcontractor recruiting & screening',
     array['read','recruiting'], 'approval'),
  ('marcushr', 'Marcus Hill',         'Head of HR & Compliance',     'Recruiting', 'Pro compliance: insurance & background checks',
     array['read','recruiting'], 'approval'),
  ('diego',    'Diego Martinez',      'Dir. Automated Client Care',  'Retention',  'Customer care, reviews & win-back',
     array['read','retention'], 'autonomous'),
  ('elenam',   'Elena Markov',        'Head of Global Accounts',     'Sales',      'Commercial (B2B) accounts',
     array['read','sales'], 'approval'),
  ('clara',    'Clara Dubois',        'Global Head Lead Gen',        'Outreach',   'Lead capture & follow-up',
     array['read','sales'], 'autonomous');


-- >>> migration 20261001183000_take_rate_guard.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261001183000_take_rate_guard.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-01_1830 UTC
-- PURPOSE : Never lose money on a job. The database rejects any job whose
--           subcontractor payout would leave us outside a 15–35% take, and any payout
--           larger than the job price. Mirrors splitJob() in packages/core/src/pricing.ts
--           (payouts round down, so the lower bound allows $1 of rounding).
-- ============================================================================

alter table public.jobs add constraint jobs_take_rate_band check (
  contractor_payout is null or price_final is null or price_final = 0
  or (contractor_payout <= price_final * 0.85 and contractor_payout >= floor(price_final * 0.65) - 1)
);

alter table public.payouts add constraint payouts_positive check (amount >= 0);

-- A payout can never exceed what the customer was charged for that job.
create or replace function public.guard_payout_amount() returns trigger
language plpgsql security definer set search_path = public as $$
declare p numeric;
begin
  if new.job_id is null then return new; end if;
  select price_final into p from public.jobs where id = new.job_id;
  if p is not null and new.amount > p * 0.85 then
    raise exception 'Payout % exceeds 85%% of job price % — take would fall below 15%%', new.amount, p;
  end if;
  return new;
end $$;
create trigger payouts_guard before insert or update of amount on public.payouts for each row execute function public.guard_payout_amount();

alter table public.services add constraint services_payout_share_band check (payout_share between 0.65 and 0.85);


-- >>> migration 20261001190000_upfront_payment.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261001190000_upfront_payment.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-01_1900 UTC
-- PURPOSE : Paid upfront, always. No job is dispatched to a pro until the customer
--           has paid. When something isn't right we make it right with a free redo,
--           a complimentary extra service, or a refund, never by withholding payment.
--           Remedies are built so a job can't go below $0 for us:
--             • refunds come out of the job proportionally (or from the pro first when
--               the pro was at fault); a payout already sent becomes a clawback against
--               the pro's next payout
--             • a complimentary service's payout is capped at our take on the original job
-- ============================================================================

alter table public.jobs
  add column paid_at timestamptz,
  add column amount_paid numeric(10,2) not null default 0,
  add column amount_refunded numeric(10,2) not null default 0,
  add column stripe_payment_intent text,
  add column parent_job_id uuid references public.jobs(id) on delete set null,
  add column remedy text check (remedy in ('redo','complimentary'));

alter table public.jobs add constraint jobs_refund_le_paid check (amount_refunded <= amount_paid);

-- Payout clawbacks (negative rows deducted from the pro's next payout run)
alter table public.payouts drop constraint if exists payouts_positive;
alter table public.payouts drop constraint if exists payouts_status_check;
alter table public.payouts add constraint payouts_status_check check (status in ('pending','approved','paid','held','clawback'));
alter table public.payouts add constraint payouts_sign check ((status = 'clawback' and amount < 0) or (status <> 'clawback' and amount >= 0));
alter table public.payouts add column reason text;

-- Payout guard: normal jobs ≤ 85% of price; a complimentary job (price 0) may pay the
-- pro at most our take on the original job, so the pair of jobs never goes negative.
create or replace function public.guard_payout_amount() returns trigger
language plpgsql security definer set search_path = public as $$
declare j record; parent_take numeric;
begin
  if new.job_id is null or new.status = 'clawback' then return new; end if;
  select price_final, parent_job_id, remedy into j from public.jobs where id = new.job_id;
  if j.remedy = 'complimentary' and j.parent_job_id is not null then
    select coalesce(price_final, 0) - coalesce(contractor_payout, 0) - coalesce(amount_refunded, 0)
      into parent_take from public.jobs where id = j.parent_job_id;
    if new.amount > greatest(parent_take, 0) then
      raise exception 'Complimentary payout % exceeds our take % on the original job', new.amount, parent_take;
    end if;
  elsif j.price_final is not null and new.amount > j.price_final * 0.85 then
    raise exception 'Payout % exceeds 85%% of job price % — take would fall below 15%%', new.amount, j.price_final;
  end if;
  return new;
end $$;

-- Take-rate band still applies to paid jobs; redo/complimentary jobs are priced at $0.
alter table public.jobs drop constraint jobs_take_rate_band;
alter table public.jobs add constraint jobs_take_rate_band check (
  contractor_payout is null or price_final is null or price_final = 0 or remedy is not null
  or amount_refunded > 0          -- refunds lower the payout via refundSplit(); our take is tested ≥ 0 there
  or (contractor_payout <= price_final * 0.85 and contractor_payout >= floor(price_final * 0.65) - 1)
);

alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check check (kind in ('deposit','final','milestone','plan','upfront','refund'));


-- >>> migration 20261001200000_contractor_workforce.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261001200000_contractor_workforce.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-01_2000 UTC
-- PURPOSE : The subcontractor workforce — our core asset.
--             • 1099 tax profile per pro (independent contractors, never employees):
--               legal name, entity type, TIN last 4 only (the full W-9 PDF lives in
--               private storage), address, payout method
--             • onboarding: W-9, signed independent-contractor agreement, insurance
--               certificate, license (licensed trades), background check — each a
--               document with verification status and expiry
--             • ledger views: per-pro scorecard (work done, bookings generated, our take
--               from their work, quality) and 1099 totals by tax year
-- ============================================================================

alter table public.contractors
  add column legal_name text,
  add column entity_type text check (entity_type in ('individual','sole_prop','llc','s_corp','c_corp','partnership')),
  add column tin_last4 text check (tin_last4 ~ '^[0-9]{4}$'),
  add column address_line text,
  add column city text,
  add column state text,
  add column zip text,
  add column w9_received_at timestamptz,
  add column agreement_version text,
  add column agreement_signed_at timestamptz,
  add column agreement_signer text,
  add column license_expires date,
  add column background_checked_at timestamptz,
  add column payout_method text check (payout_method in ('ach','stripe_connect','check')),
  add column payout_account_last4 text,
  add column onboarded_at timestamptz,
  add column offboarded_at timestamptz,
  add column offboard_reason text,
  add column application_id uuid references public.contractor_applications(id) on delete set null;

create table public.contractor_documents (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  kind text not null check (kind in ('w9','coi','license','background','agreement','other')),
  storage_path text,
  expires_on date,
  status text not null default 'pending' check (status in ('pending','verified','rejected','expired')),
  verified_by text,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index contractor_documents_idx on public.contractor_documents(contractor_id, kind, created_at desc);

alter table public.contractor_documents enable row level security;
create policy staff_all on public.contractor_documents for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy docs_pro_read on public.contractor_documents for select to authenticated using (contractor_id = public.my_contractor_id());

insert into storage.buckets (id, name, public) values ('pro-docs', 'pro-docs', false) on conflict (id) do nothing;
create policy pro_docs_staff on storage.objects for all to authenticated
  using (bucket_id = 'pro-docs' and public.is_staff()) with check (bucket_id = 'pro-docs' and public.is_staff());

-- Per-pro scorecard: the asset view. security_invoker → RLS of the caller applies.
create view public.contractor_scorecard with (security_invoker = true) as
select
  c.id as contractor_id,
  c.business_name,
  c.status,
  c.trades,
  c.rating,
  c.acceptance_rate,
  c.on_time_rate,
  c.onboarded_at,
  count(j.id) filter (where j.status = 'completed' and j.remedy is null)                         as jobs_completed,
  count(j.id) filter (where j.status = 'completed' and j.completed_at > now() - interval '90 days' and j.remedy is null) as jobs_90d,
  count(j.id) filter (where j.remedy = 'redo')                                                    as redos,
  coalesce(sum(j.price_final) filter (where j.status = 'completed' and j.remedy is null), 0)     as bookings_generated,
  coalesce(sum(j.price_final - j.contractor_payout - j.amount_refunded) filter (where j.status = 'completed' and j.remedy is null), 0) as take_generated,
  coalesce(sum(j.price_final - j.contractor_payout - j.amount_refunded) filter (where j.status = 'completed' and j.remedy is null and j.completed_at > now() - interval '90 days'), 0) as take_90d,
  coalesce(sum(j.amount_refunded), 0)                                                             as refunds_on_their_jobs,
  count(j.id) filter (where (j.ai_qa->>'passed')::boolean is true)                               as qa_passed,
  count(j.id) filter (where j.ai_qa is not null)                                                  as qa_checked,
  max(j.completed_at)                                                                              as last_job_at
from public.contractors c
left join public.jobs j on j.contractor_id = c.id
group by c.id;

-- 1099 totals by tax year: money actually paid out, net of clawbacks.
create view public.contractor_1099 with (security_invoker = true) as
select
  c.id as contractor_id,
  c.business_name,
  c.legal_name,
  c.entity_type,
  c.tin_last4,
  c.address_line, c.city, c.state, c.zip,
  c.w9_received_at,
  extract(year from coalesce(p.paid_at, p.created_at))::int as tax_year,
  sum(p.amount) filter (where p.status in ('paid','clawback')) as paid_total,
  sum(p.amount) filter (where p.status in ('approved','pending','held')) as owed_total,
  count(*) filter (where p.status = 'paid') as payments
from public.contractors c
join public.payouts p on p.contractor_id = c.id
group by c.id, tax_year;

-- ─── Ratings on every job: the customer AND us ──────────────────────────────
-- Customer → public.reviews (stars + comment). Company → ops_ratings (staff, IEBC agent, or a
-- draft from the AI photo QA that staff can override). A pro's rating = 60% customer + 40%
-- ours over their last 50 rated jobs, and it drives dispatch ranking.
create table public.ops_ratings (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  quality int check (quality between 1 and 5),
  punctuality int check (punctuality between 1 and 5),
  professionalism int check (professionalism between 1 and 5),
  comment text,
  source text not null default 'staff' check (source in ('staff','ai_qa','iebc')),
  rated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ops_ratings enable row level security;
create policy staff_all on public.ops_ratings for all to authenticated using (public.is_staff()) with check (public.is_staff());
create trigger ops_ratings_touch before update on public.ops_ratings for each row execute function public.touch_updated_at();

create or replace function public.recompute_contractor_rating(cid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare cust numeric; ours numeric;
begin
  if cid is null then return; end if;
  select avg(rating) into cust from (select rating from public.reviews where contractor_id = cid order by created_at desc limit 50) r;
  select avg(rating) into ours from (select rating from public.ops_ratings where contractor_id = cid order by created_at desc limit 50) o;
  if cust is null and ours is null then return; end if;
  update public.contractors set rating = round(case
      when cust is not null and ours is not null then 0.6 * cust + 0.4 * ours
      else coalesce(cust, ours) end, 1)
  where id = cid;
end $$;

-- The pro on a customer review always comes from the job (never from the browser).
create or replace function public.reviews_set_contractor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select contractor_id into new.contractor_id from public.jobs where id = new.job_id;
  return new;
end $$;
create trigger reviews_set_contractor before insert or update on public.reviews for each row execute function public.reviews_set_contractor();

create or replace function public.ratings_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.recompute_contractor_rating(new.contractor_id);
  return new;
end $$;
create trigger reviews_rating_rollup after insert or update on public.reviews for each row execute function public.ratings_changed();
create trigger ops_ratings_rollup after insert or update on public.ops_ratings for each row execute function public.ratings_changed();


-- >>> migration 20261001203000_service_agreement.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261001203000_service_agreement.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-01_2030 UTC
-- PURPOSE : Every booking is accepted under the customer Service Agreement printed on its
--           invoice. Record which version, when, and from where it was accepted.
-- ============================================================================
alter table public.jobs
  add column terms_version text,
  add column terms_accepted_at timestamptz,
  add column terms_accepted_ip text;


-- >>> migration 20261001204300_offers_push_notifications.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261001204300_offers_push_notifications.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-01_2043 UTC
-- PURPOSE : Uber-style job offers and phone notifications.
--             • push_tokens     — Expo push tokens per signed-in device (pros and customers)
--             • notifications   — in-app inbox + delivery log of every push/email we send
--             • jobs.instructions — ops/IEBC instructions printed on the pro's work order
--             • job_offers acceptance record — which work-order version the pro agreed to
--             • job_pro(job)    — the customer's safe view of who is covering their job
-- ============================================================================

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  platform text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;
create policy staff_all on public.push_tokens for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy push_tokens_self on public.push_tokens for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create table public.notifications (
  id bigint generated always as identity primary key,
  profile_id uuid references public.profiles(id) on delete cascade,
  email text,
  title text not null,
  body text not null,
  data jsonb not null default '{}',
  channels text[] not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_profile_idx on public.notifications(profile_id, created_at desc);
alter table public.notifications enable row level security;
create policy staff_all on public.notifications for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy notifications_self_read on public.notifications for select to authenticated using (profile_id = auth.uid());
create policy notifications_self_mark on public.notifications for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
alter publication supabase_realtime add table public.notifications;

alter table public.jobs add column instructions text;

alter table public.job_offers
  add column work_order_version text,
  add column terms_accepted_at timestamptz,
  add column accepted_ip text;

-- Who is covering my job? Business name, rating and track record of the assigned pro —
-- only for the customer on that job (customers can't read the contractors table directly).
create or replace function public.job_pro(p_job uuid)
returns table (business_name text, contact_first_name text, rating numeric, jobs_completed int)
language sql stable security definer set search_path = public as $$
  select c.business_name, split_part(c.contact_name, ' ', 1), c.rating, c.jobs_completed
  from public.jobs j join public.contractors c on c.id = j.contractor_id
  where j.id = p_job and (j.customer_id = auth.uid() or public.is_staff())
$$;
grant execute on function public.job_pro(uuid) to authenticated;


-- >>> migration 20261001205300_deposits_quick_charge.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261001205300_deposits_quick_charge.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-01_2053 UTC
-- PURPOSE : Deposits and Quick Charge payment links.
--             • jobs.payment_plan 'full' | 'deposit'; deposit amount, when it was paid, and
--               when the balance is due. A deposit books the date and the pro; the job can't
--               start and the pro isn't paid out until it's paid in full (jobs.paid_at).
--             • payments can exist without a job (a Quick Charge for anything), carry a
--               description, the customer, the Stripe link and who created it.
-- ============================================================================

alter table public.jobs
  add column payment_plan text not null default 'full' check (payment_plan in ('full','deposit')),
  add column deposit_amount numeric(10,2),
  add column deposit_paid_at timestamptz,
  add column balance_due_date date;

alter table public.payments alter column job_id drop not null;
alter table public.payments
  add column description text,
  add column customer_name text,
  add column customer_email text,
  add column link_url text,
  add column created_by text,
  add column paid_at timestamptz;

alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check
  check (kind in ('deposit','final','milestone','plan','upfront','refund','balance','change_order','custom'));


-- >>> migration 20261001210900_pro_vetting.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261001210900_pro_vetting.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-01_2109 UTC
-- PURPOSE : Pro specialties, trade-specific insurance and a richer application.
--             • contractors.specialties — what each pro does best (dispatch prefers specialists)
--             • contractors.coverage    — verified coverage → expiry, e.g.
--                 {"auto":"2027-05-01","bond":"2027-01-31","workers_comp":"exempt"}
--               (general liability stays in insured_until). Offers stop when one lapses.
--             • contractor_applications — specialties, coverages held, equipment, references,
--               links to past work
--             • contractor_documents.kind — commercial auto, workers' comp, bond, liquor
--               liability, certifications and the skills check
-- ============================================================================

alter table public.contractors
  add column specialties text[] not null default '{}',
  add column coverage jsonb not null default '{}';

alter table public.contractor_applications
  add column specialties text[] not null default '{}',
  add column coverages_held text[] not null default '{}',
  add column equipment text,
  add column references_text text,
  add column work_links text;

alter table public.contractor_documents drop constraint if exists contractor_documents_kind_check;
alter table public.contractor_documents add constraint contractor_documents_kind_check
  check (kind in ('w9','coi','license','background','agreement','auto','workers_comp','bond','liquor','certification','skills','other'));


-- >>> migration 20261001212400_pro_benefits.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261001212400_pro_benefits.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-01_2124 UTC
-- PURPOSE : The six Pro Program benefits.
--             • pro_program_settings — who qualifies for each benefit and its amounts
--               (Handled Hub → Pro Program; defaults live in packages/core/src/pro-policy.ts)
--             • payouts.kind — job | show_up | guarantee | stipend | materials | clawback,
--               plus instant-pay method, fee and Stripe transfer. Only 'job' payouts are
--               held to the 85%-of-price guard; show-up pay is capped in code at the fee we
--               keep; materials are passed through only after the customer pays them.
--             • job_expenses — materials receipts from pros (auto-approve / staff review)
--             • jobs cancellation record — who cancelled, when, why and the fee kept
-- ============================================================================

create table public.pro_program_settings (
  id int primary key default 1 check (id = 1),
  settings jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.pro_program_settings enable row level security;
create policy staff_all on public.pro_program_settings for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy settings_read on public.pro_program_settings for select to authenticated using (true);
insert into public.pro_program_settings (id) values (1) on conflict (id) do nothing;

alter table public.payouts
  add column kind text not null default 'job' check (kind in ('job','show_up','guarantee','stipend','materials','clawback')),
  add column method text check (method in ('weekly','instant','manual')),
  add column instant_fee numeric(10,2) not null default 0,
  add column stripe_transfer_id text;
update public.payouts set kind = 'clawback' where status = 'clawback';
create index payouts_contractor_status_idx on public.payouts(contractor_id, status);

-- The 85%-of-price guard applies to the job's own payout; complimentary rules unchanged.
create or replace function public.guard_payout_amount() returns trigger
language plpgsql security definer set search_path = public as $$
declare j record; parent_take numeric;
begin
  if new.job_id is null or new.status = 'clawback' or new.kind <> 'job' then return new; end if;
  select price_final, parent_job_id, remedy into j from public.jobs where id = new.job_id;
  if j.remedy = 'complimentary' and j.parent_job_id is not null then
    select coalesce(price_final, 0) - coalesce(contractor_payout, 0) - coalesce(amount_refunded, 0)
      into parent_take from public.jobs where id = j.parent_job_id;
    if new.amount > greatest(parent_take, 0) then
      raise exception 'Complimentary payout % exceeds our take % on the original job', new.amount, parent_take;
    end if;
  elsif j.price_final is not null and new.amount > j.price_final * 0.85 then
    raise exception 'Payout % exceeds 85%% of job price % — take would fall below 15%%', new.amount, j.price_final;
  end if;
  return new;
end $$;

create table public.job_expenses (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  description text not null,
  receipt_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','billed','paid')),
  decided_by text,
  decided_at timestamptz,
  payment_id uuid references public.payments(id) on delete set null,
  payout_id uuid references public.payouts(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);
create index job_expenses_job_idx on public.job_expenses(job_id);
alter table public.job_expenses enable row level security;
create policy staff_all on public.job_expenses for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy expenses_pro_read on public.job_expenses for select to authenticated using (contractor_id = public.my_contractor_id());

alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check
  check (kind in ('deposit','final','milestone','plan','upfront','refund','balance','change_order','custom','materials'));

alter table public.jobs
  add column cancelled_at timestamptz,
  add column cancel_reason text check (cancel_reason in ('customer','late','lockout','ops','weather','pro')),
  add column cancel_fee numeric(10,2) not null default 0;

alter table public.contractors add column insurance_stipend_paid_at timestamptz;


-- >>> migration 20261001233400_dispatch_geo_availability.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261001233400_dispatch_geo_availability.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-01_2334 UTC
-- PURPOSE : Dispatch by availability, quality and location.
--             • contractors: base ZIP + coordinates, driving radius, working days/windows,
--               time off — used by dispatch and the customer booking calendar
--             • jobs: coordinates (ZIP centroid) for distance to each pro
--             • zip_geo: cached ZIP centroids (looked up once, reused)
--             • jobs.scope_extra: extra work the pro found on site (change orders) — the
--               underbid signal Finance reports per service
-- ============================================================================

alter table public.contractors
  add column base_zip text check (base_zip ~ '^[0-9]{5}$'),
  add column base_lat double precision,
  add column base_lng double precision,
  add column service_radius_mi int not null default 25 check (service_radius_mi between 1 and 150),
  add column availability jsonb,
  add column time_off date[] not null default '{}';

alter table public.jobs
  add column lat double precision,
  add column lng double precision,
  add column scope_extra numeric(10,2) not null default 0;

create table public.zip_geo (
  zip text primary key check (zip ~ '^[0-9]{5}$'),
  lat double precision not null,
  lng double precision not null,
  city text,
  state text,
  fetched_at timestamptz not null default now()
);
alter table public.zip_geo enable row level security;
create policy zip_geo_read on public.zip_geo for select to anon, authenticated using (true);


-- >>> migration 20261002000600_pro_recruiting.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261002000600_pro_recruiting.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-02_0006 UTC
-- PURPOSE : Automated pro recruiting & onboarding, tracked end to end.
--             • contractor_applications: where the applicant came from (source, referral,
--               UTM), the pipeline stage, timestamps, follow-ups sent and the linked contractor
--             • contractors: invite / reminder tracking, background-check provider status
--             • contractor_documents.ai_check: AI reading of each uploaded certificate/license
--             • recruiting_events: every touch (applied, screened, invited, reminded, step done,
--               document verified, background clear, activated, dropped) — the full history
--             • recruiting_settings: auto-invite / auto-activate / reminder schedule (Hub)
--             • fix: link a pro record to an existing login with the same email (people who
--               signed up before they applied were locked out of the pro portal)
-- ============================================================================

alter table public.contractor_applications
  add column source text,
  add column referred_by uuid references public.contractors(id) on delete set null,
  add column utm jsonb,
  add column stage text not null default 'applied' check (stage in ('applied','screened','invited','rejected','withdrawn')),
  add column screened_at timestamptz,
  add column invited_at timestamptz,
  add column decided_by text,
  add column last_contact_at timestamptz,
  add column reminders_sent int not null default 0,
  add column contractor_id uuid references public.contractors(id) on delete set null;
create index contractor_applications_email_idx on public.contractor_applications(lower(email));
update public.contractor_applications set stage = case status when 'approved' then 'invited' when 'rejected' then 'rejected' else 'applied' end;

alter table public.contractors
  add column invited_at timestamptz,
  add column last_reminder_at timestamptz,
  add column onboarding_reminders int not null default 0,
  add column background_provider_id text,
  add column background_status text check (background_status in ('invited','pending','clear','consider','suspended','canceled')),
  add column dropped_at timestamptz;

alter table public.contractor_documents add column ai_check jsonb;

create table public.recruiting_events (
  id bigint generated always as identity primary key,
  application_id uuid references public.contractor_applications(id) on delete cascade,
  contractor_id uuid references public.contractors(id) on delete cascade,
  kind text not null,
  note text,
  actor text not null default 'system',
  created_at timestamptz not null default now()
);
create index recruiting_events_app_idx on public.recruiting_events(application_id, created_at);
create index recruiting_events_pro_idx on public.recruiting_events(contractor_id, created_at);
alter table public.recruiting_events enable row level security;
create policy staff_all on public.recruiting_events for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table public.recruiting_settings (
  id int primary key default 1 check (id = 1),
  settings jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.recruiting_settings enable row level security;
create policy staff_all on public.recruiting_settings for all to authenticated using (public.is_staff()) with check (public.is_staff());
insert into public.recruiting_settings (id) values (1) on conflict (id) do nothing;

-- Link a pro record to an existing login with the same email, whenever the record is created
-- or its email changes (the sign-up trigger only covered logins created afterwards).
create or replace function public.link_contractor_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.profile_id is null then
    select id into new.profile_id from public.profiles where lower(email) = lower(new.email) limit 1;
  end if;
  return new;
end $$;
create trigger contractors_link_profile before insert or update of email on public.contractors
  for each row execute function public.link_contractor_profile();

create or replace function public.promote_contractor_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.profile_id is not null then
    update public.profiles set role = 'pro' where id = new.profile_id and role = 'customer';
  end if;
  return new;
end $$;
create trigger contractors_promote_profile after insert or update of profile_id on public.contractors
  for each row execute function public.promote_contractor_profile();

-- backfill: existing pro records whose person already had a login
update public.contractors c set profile_id = p.id from public.profiles p
  where c.profile_id is null and lower(p.email) = lower(c.email);


-- >>> migration 20261002015700_iebc_recruiting_roles.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261002015700_iebc_recruiting_roles.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-02_0157 UTC
-- PURPOSE : IEBC recruiting agents work the automated onboarding pipeline.
--             • Tyler Walsh — recruiting pipeline: screening, invites, follow-up with stuck applicants
--             • Marcus Hill — onboarding compliance: documents (with AI readings) & background checks
--           Both run low-risk actions (reminders, notes, revive, order a background check) on
--           their own; inviting, activating and verifying documents are high-risk and always
--           wait for human approval in Handled Hub → IEBC Workforce.
-- ============================================================================
update public.iebc_agents set role_here = 'Recruiting pipeline: screening, invites & follow-up with stuck applicants', autonomy = 'autonomous'
  where iebc_employee_id = 'tylerw';
update public.iebc_agents set role_here = 'Onboarding compliance: insurance & license documents, background checks', autonomy = 'autonomous'
  where iebc_employee_id = 'marcushr';


-- >>> migration 20261002020100_transportation.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261002020100_transportation.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-02_0201 UTC
-- PURPOSE : Transportation (private driver, airport transfer, limousine, party bus, charter bus,
--           event shuttle) booked with licensed operator companies. Operators upload passenger-
--           carrier auto liability ($1.5M up to 15 seats / $5M for 16+), stored as coverage
--           kind 'passenger_auto'. The services themselves come from the catalog sync / seed.
-- ============================================================================
alter table public.contractor_documents drop constraint if exists contractor_documents_kind_check;
alter table public.contractor_documents add constraint contractor_documents_kind_check
  check (kind in ('w9','coi','license','background','agreement','auto','workers_comp','bond','liquor','passenger_auto','certification','skills','other'));


-- >>> migration 20261002023316_pro_promises.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261002023316_pro_promises.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-02_0233 UTC
-- PURPOSE : What the Pro Program promises, backed by data:
--             • offer status 'taken' — another pro accepted first; doesn't count against
--               anyone's acceptance rate (tiers use real acceptance and on-time numbers)
--             • payout kind 'referral' + contractors.referral_bonus_paid_at — the refer-a-pro
--               bonus is paid automatically, exactly once
--             • payouts.week_of — the automatic Monday payout run each payout went out in
--             • job_offers.kind — 'recurring' (your recurring customer, offered to you first)
--               and 'redo' (your first chance to fix a job) so pros see why they got it
-- ============================================================================
alter type offer_status add value if not exists 'taken';

alter table public.payouts drop constraint if exists payouts_kind_check;
alter table public.payouts add constraint payouts_kind_check
  check (kind in ('job','show_up','guarantee','stipend','materials','clawback','referral'));
alter table public.payouts add column if not exists week_of date;

alter table public.contractors add column if not exists referral_bonus_paid_at timestamptz;

alter table public.job_offers add column if not exists kind text not null default 'job'
  check (kind in ('job','recurring','redo'));


-- >>> migration 20261002025553_pro_roster.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261002025553_pro_roster.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-02_0255 UTC
-- PURPOSE : Know where pros are and when they can work:
--             • on_call_until — the pro switched "On call" on (same-day work) until this time
--             • last_lat / last_lng / last_located_at — last phone location, shared only while
--               on call or on a job today; the daily sweep clears it after 12 hours
--           Their calendar (jobs ahead, days off, daily limit) uses existing columns.
-- ============================================================================
alter table public.contractors
  add column if not exists on_call_until timestamptz,
  add column if not exists last_lat double precision,
  add column if not exists last_lng double precision,
  add column if not exists last_located_at timestamptz;

create index if not exists contractors_on_call_idx on public.contractors (on_call_until) where on_call_until is not null;
create index if not exists jobs_contractor_date_idx on public.jobs (contractor_id, scheduled_date);


-- >>> migration 20261002030209_customer_timing_budget.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261002030209_customer_timing_budget.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-02_0302 UTC
-- PURPOSE : Track what customers tell us when they ask for work:
--             jobs.urgency          — asap / this_week / two_weeks / month / flexible
--             jobs.needed_by        — last day they need it done (deadline alerts use it)
--             jobs.customer_budget  — what they want to spend (never changes our price)
--             business_accounts.monthly_budget / start_by — the same for business proposals
-- ============================================================================
alter table public.jobs
  add column if not exists urgency text check (urgency in ('asap','this_week','two_weeks','month','flexible')),
  add column if not exists needed_by date,
  add column if not exists customer_budget numeric(12,2) check (customer_budget is null or customer_budget >= 0);

create index if not exists jobs_needed_by_idx on public.jobs (needed_by) where status not in ('completed','cancelled');

alter table public.business_accounts
  add column if not exists monthly_budget numeric(12,2),
  add column if not exists start_by text check (start_by in ('asap','this_week','two_weeks','month','flexible'));


-- >>> migration 20261002031601_launch_growth.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261002031601_launch_growth.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-02_0316 UTC
-- PURPOSE : Launch blockers + growth + customer experience, in one place:
--             • rate_limits + hit_rate_limit()   — abuse limits on public endpoints (AI, uploads)
--             • payment_disputes                 — Stripe chargebacks: payout held, ops alerted
--             • promo_codes / promo_redemptions  — promo codes, gift cards, referral rewards
--             • memberships                      — Handled Plus (monthly subscription)
--             • tips                             — 100% to the pro
--             • jobs: discount, promo_code, attribution, en_route_at
--             • profiles: locale, sms_opt_out, referred_by, referral_rewarded_at,
--               deleted_at (account deletion keeps tax/financial records, drops personal data)
-- ============================================================================

-- ─── Abuse limits ───────────────────────────────────────────────────────────
create table if not exists public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;

-- Atomically count a hit; true = allowed. Window is fixed (e.g. 3600s = per hour).
create or replace function public.hit_rate_limit(p_key text, p_window_seconds int, p_max int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n int;
begin
  insert into public.rate_limits as r (key, window_start, hits) values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into n;
  return n <= p_max;
end $$;
revoke all on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;

-- ─── Chargebacks ────────────────────────────────────────────────────────────
create table if not exists public.payment_disputes (
  id uuid primary key default gen_random_uuid(),
  stripe_dispute_id text not null unique,
  payment_intent text,
  job_id uuid references public.jobs(id) on delete set null,
  amount numeric(10,2) not null,
  reason text,
  status text not null,
  evidence_due_by timestamptz,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
alter table public.payment_disputes enable row level security;

-- ─── Money kinds ────────────────────────────────────────────────────────────
alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check
  check (kind in ('deposit','final','milestone','plan','upfront','refund','balance','change_order','custom','materials','tip','gift_card','membership'));

alter table public.payouts drop constraint if exists payouts_kind_check;
alter table public.payouts add constraint payouts_kind_check
  check (kind in ('job','show_up','guarantee','stipend','materials','clawback','referral','tip'));

-- ─── Promo codes, gift cards, referral rewards ──────────────────────────────
create table if not exists public.promo_codes (
  code text primary key check (code = upper(code) and length(code) between 3 and 40),
  kind text not null check (kind in ('percent','amount','gift')),
  value numeric(10,2) not null check (value > 0),
  balance numeric(10,2),                         -- gift cards / referral credit: what's left
  max_uses int,                                  -- null = unlimited
  uses int not null default 0,
  first_job_only boolean not null default false,
  min_order numeric(10,2) not null default 0,
  expires_at timestamptz,
  active boolean not null default true,
  source text not null default 'staff' check (source in ('staff','gift_card','referral','referral_reward')),
  owner_profile_id uuid references public.profiles(id) on delete set null,
  purchaser_email text,
  recipient_email text,
  note text,
  created_by text,
  payment_id uuid references public.payments(id) on delete set null, -- gift card purchase
  created_at timestamptz not null default now()
);
alter table public.promo_codes enable row level security;

create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.promo_codes(code),
  job_id uuid references public.jobs(id) on delete set null,
  email text,
  amount numeric(10,2) not null,
  created_at timestamptz not null default now()
);
alter table public.promo_redemptions enable row level security;
create index if not exists promo_redemptions_code_idx on public.promo_redemptions (code);

-- Atomic gift-card / credit draw-down: takes up to p_amount, returns what was taken.
create or replace function public.draw_promo_balance(p_code text, p_amount numeric)
returns numeric language plpgsql security definer set search_path = public as $$
declare b numeric; took numeric;
begin
  select balance into b from public.promo_codes
   where code = p_code and active and coalesce(balance, 0) > 0 and (expires_at is null or expires_at > now())
   for update;
  if not found then return 0; end if;
  took := least(b, p_amount);
  update public.promo_codes set balance = b - took, uses = uses + 1 where code = p_code;
  return took;
end $$;
revoke all on function public.draw_promo_balance(text, numeric) from public, anon, authenticated;

-- ─── Handled Plus membership ────────────────────────────────────────────────
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  email text not null,
  status text not null default 'pending' check (status in ('pending','active','past_due','canceled')),
  plan text not null default 'plus_monthly',
  stripe_customer_id text,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  canceled_at timestamptz
);
alter table public.memberships enable row level security;
create index if not exists memberships_email_idx on public.memberships (lower(email));
create policy "own membership" on public.memberships for select using (profile_id = auth.uid());

-- ─── Tips ───────────────────────────────────────────────────────────────────
create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  contractor_id uuid references public.contractors(id) on delete set null,
  amount numeric(10,2) not null check (amount > 0),
  payment_id uuid references public.payments(id),
  status text not null default 'pending' check (status in ('pending','paid')),
  created_at timestamptz not null default now()
);
alter table public.tips enable row level security;

-- ─── Jobs & profiles ────────────────────────────────────────────────────────
alter table public.jobs
  add column if not exists promo_code text,
  add column if not exists discount numeric(10,2) not null default 0,
  add column if not exists member_benefit numeric(10,2) not null default 0,
  add column if not exists attribution jsonb,
  add column if not exists en_route_at timestamptz,
  add column if not exists tip_total numeric(10,2) not null default 0,
  add column if not exists disputed_at timestamptz;

alter table public.profiles
  add column if not exists locale text not null default 'en' check (locale in ('en','es')),
  add column if not exists sms_opt_out boolean not null default false,
  add column if not exists referred_by uuid references public.profiles(id) on delete set null,
  add column if not exists referral_rewarded_at timestamptz,
  add column if not exists deleted_at timestamptz;

-- ─── Account deletion: nothing may block removing a person ──────────────────
alter table public.messages drop constraint if exists messages_sender_id_fkey;
alter table public.messages add constraint messages_sender_id_fkey foreign key (sender_id) references public.profiles(id) on delete set null;
alter table public.business_accounts drop constraint if exists business_accounts_owner_profile_id_fkey;
alter table public.business_accounts add constraint business_accounts_owner_profile_id_fkey foreign key (owner_profile_id) references public.profiles(id) on delete set null;


-- >>> migration 20261002134642_launch_checklist.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261002134642_launch_checklist.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-02_1346 UTC
-- PURPOSE : Business & legal launch checklist ticks (items live in @handled/core
--           launch-checklist.ts): who ticked it, when, and a note (policy number, attorney…).
-- ============================================================================
create table if not exists public.launch_checklist (
  key text primary key,
  done_at timestamptz,
  done_by text,
  note text,
  updated_at timestamptz not null default now()
);
alter table public.launch_checklist enable row level security;


-- >>> migration 20261002141249_message_language.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261002141249_message_language.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-02_1412 UTC
-- PURPOSE : Each person chooses English or Spanish, and every text, email, push notification
--           and timeline entry follows it:
--             • profiles.locale (already exists) — signed-in customers and pros
--             • jobs.locale — the language a booking was made in (guests have no profile)
--             • contractor_applications.locale — applicants, before they have an account
--             • job_events.message_es — Spanish version of each timeline entry
-- ============================================================================
alter table public.jobs add column if not exists locale text not null default 'en' check (locale in ('en','es'));
alter table public.contractor_applications add column if not exists locale text not null default 'en' check (locale in ('en','es'));
alter table public.job_events add column if not exists message_es text;


-- >>> migration 20261002223400_waitlist_google_reviews.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261002223400_waitlist_google_reviews.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-02_2234 UTC
-- PURPOSE : Growth — finding customers and pros:
--             • waitlist — people who asked for a service where we have no pros yet; they're
--               told the day a pro starts covering their ZIP, and the counts drive recruiting
--               (Hub → Supply gaps)
--             • reviews.google_clicked_at — customer tapped "Review us on Google" after rating
-- ============================================================================

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null check (position('@' in email) > 1),
  phone text,
  name text,
  zip text not null check (zip ~ '^[0-9]{5}$'),
  service_slug text not null,
  locale text not null default 'en' check (locale in ('en','es')),
  profile_id uuid references public.profiles(id) on delete set null,
  source text not null default 'booking',
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  unique (email, service_slug, zip)
);
alter table public.waitlist enable row level security; -- written and read by the server only
create index if not exists waitlist_open_idx on public.waitlist (service_slug, zip) where notified_at is null;

alter table public.reviews add column if not exists google_clicked_at timestamptz;


-- >>> migration 20261003001500_seasonal_quote_followups.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261003001500_seasonal_quote_followups.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-03_0015 UTC
-- PURPOSE : Bringing customers back:
--             • saved_quotes     — "Email me this price": the price, then follow-ups, with a link
--                                  that reopens the booking with their answers filled in
--             • marketing_sends  — every seasonal reminder / quote follow-up sent (never twice,
--                                  at most one seasonal email a month per person)
--             • email_optouts    — one-click unsubscribe from reminders (booking messages still go)
-- ============================================================================

create table if not exists public.saved_quotes (
  id uuid primary key default gen_random_uuid(),
  email text not null check (position('@' in email) > 1),
  service_slug text not null,
  answers jsonb not null default '{}',
  frequency text not null default 'once',
  price numeric(10,2),
  locale text not null default 'en' check (locale in ('en','es')),
  profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  followups_sent int not null default 0,
  last_followup_at timestamptz,
  booked_job_id uuid references public.jobs(id) on delete set null
);
alter table public.saved_quotes enable row level security; -- server only
create index if not exists saved_quotes_open_idx on public.saved_quotes (created_at) where booked_job_id is null;
create index if not exists saved_quotes_email_idx on public.saved_quotes (lower(email));

create table if not exists public.marketing_sends (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  kind text not null check (kind in ('seasonal','quote_followup','booking_followup')),
  key text not null,
  job_id uuid references public.jobs(id) on delete set null,
  sent_at timestamptz not null default now(),
  unique (email, kind, key)
);
alter table public.marketing_sends enable row level security;
create index if not exists marketing_sends_recent_idx on public.marketing_sends (lower(email), sent_at desc);

create table if not exists public.email_optouts (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table public.email_optouts enable row level security;


-- >>> migration 20261003003900_contract_records.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261003003900_contract_records.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-03_0039 UTC
-- PURPOSE : Every contract a customer, business or pro accepts — with a frozen copy of the exact
--           text they agreed to (sections + SHA-256 hash), when, how (booking, e-signature,
--           checkout), and from where. Shown in each person's account ("My contracts"), in the
--           pro portal, and in Hub → Contract library. Kept after account deletion (legal record);
--           the profile link is cleared, the email stays.
-- ============================================================================

create table if not exists public.contract_acceptances (
  id uuid primary key default gen_random_uuid(),
  contract_key text not null,
  version text not null,
  title text not null,
  audience text not null check (audience in ('customer','business','pro')),
  profile_id uuid references public.profiles(id) on delete set null,
  contractor_id uuid references public.contractors(id) on delete set null,
  email text,
  signer_name text,
  job_id uuid references public.jobs(id) on delete set null,
  method text not null default 'click' check (method in ('booking','signature','checkout','click')),
  ip text,
  user_agent text,
  sections jsonb not null,
  content_hash text not null,
  accepted_at timestamptz not null default now()
);
alter table public.contract_acceptances enable row level security;
create index if not exists contract_acceptances_profile_idx on public.contract_acceptances (profile_id, accepted_at desc);
create index if not exists contract_acceptances_contractor_idx on public.contract_acceptances (contractor_id, accepted_at desc);
create index if not exists contract_acceptances_email_idx on public.contract_acceptances (lower(email));
create index if not exists contract_acceptances_key_idx on public.contract_acceptances (contract_key, version);

-- People read their own records (written by the server only).
create policy "own contracts" on public.contract_acceptances for select using (
  profile_id = auth.uid()
  or contractor_id in (select id from public.contractors where profile_id = auth.uid())
);


-- >>> migration 20261003004900_contract_language.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261003004900_contract_language.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-03_0049 UTC
-- PURPOSE : Contracts in Spanish: record the language each person read when they accepted.
--           The frozen copy (sections) also keeps the Spanish text they saw; English controls.
-- ============================================================================
alter table public.contract_acceptances
  add column if not exists locale text not null default 'en' check (locale in ('en','es'));


-- >>> migration 20261003011700_pro_fairness.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261003011700_pro_fairness.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-03_0117 UTC
-- PURPOSE : Make the system do what the Independent Contractor Agreement promises:
--             • pro_deductions        — a refund or lost chargeback charged to a pro is only a
--                                        PROPOSAL: written notice, 3 business days to respond, a
--                                        person decides; applied amounts never exceed half of a
--                                        weekly payout and never touch tips
--             • pro_standing_events   — late cancels, no-shows, warnings, suspensions,
--                                        deactivations, appeals and reinstatements, with reasons
--             • contractors.standing  — good / warned / suspended / deactivated (+ dates)
-- ============================================================================

create table if not exists public.pro_deductions (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  amount numeric(10,2) not null check (amount > 0),
  reason text not null,
  source text not null check (source in ('refund','chargeback')),
  status text not null default 'proposed' check (status in ('proposed','upheld','waived')),
  respond_by timestamptz not null,
  pro_response text,
  responded_at timestamptz,
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);
alter table public.pro_deductions enable row level security;
create index if not exists pro_deductions_open_idx on public.pro_deductions (status, respond_by);
create index if not exists pro_deductions_pro_idx on public.pro_deductions (contractor_id, created_at desc);
create policy "pro reads own deductions" on public.pro_deductions for select using (
  contractor_id in (select id from public.contractors where profile_id = auth.uid())
);

create table if not exists public.pro_standing_events (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  kind text not null check (kind in ('late_cancel','no_show','warning','suspension','deactivation','appeal','appeal_upheld','reinstated','note')),
  job_id uuid references public.jobs(id) on delete set null,
  note text,
  actor text,
  created_at timestamptz not null default now()
);
alter table public.pro_standing_events enable row level security;
create index if not exists pro_standing_pro_idx on public.pro_standing_events (contractor_id, created_at desc);
create policy "pro reads own standing" on public.pro_standing_events for select using (
  contractor_id in (select id from public.contractors where profile_id = auth.uid())
);

alter table public.contractors
  add column if not exists standing text not null default 'good' check (standing in ('good','warned','suspended','deactivated')),
  add column if not exists standing_reason text,
  add column if not exists warned_at timestamptz,
  add column if not exists improve_by date,
  add column if not exists appeal_by date,
  add column if not exists appeal_decide_by date,
  add column if not exists background_recheck_due date;

-- Payout rows can be held for a deduction decision; a deduction's applied piece is recorded as a clawback row.
alter table public.payouts add column if not exists deduction_id uuid references public.pro_deductions(id) on delete set null;


-- >>> migration 20261003014600_market_pricing.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261003014600_market_pricing.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-03_0146 UTC
-- PURPOSE : Market pricing — the market sets the price, inside guardrails:
--             • jobs.suggested_price / customer_offer — our suggestion vs. what the customer offered
--             • job_offers counter — a pro can say "I'll do it for $X" (status 'countered');
--               the customer accepts (pays the difference) or not
--             • price_signals    — every accept / decline / counter / expiry vs. the suggestion
--             • market_factors   — what we learned per service (and ZIP area): the suggested price
--                                  moves toward what pros actually accept, bounded 0.85–1.30×,
--                                  with a manual override in Hub → Market pricing
-- ============================================================================
alter type offer_status add value if not exists 'countered';

alter table public.job_offers
  add column if not exists counter_payout numeric(10,2),
  add column if not exists counter_price numeric(10,2),
  add column if not exists counter_note text,
  add column if not exists countered_at timestamptz;

alter table public.jobs
  add column if not exists suggested_price numeric(10,2),
  add column if not exists customer_offer numeric(10,2),
  add column if not exists booking_fee numeric(10,2) not null default 0,
  add column if not exists offer_nudged_at timestamptz,
  add column if not exists pending_counter_offer uuid references public.job_offers(id) on delete set null,
  add column if not exists pending_raise numeric(10,2);

create table if not exists public.price_signals (
  id uuid primary key default gen_random_uuid(),
  service_slug text not null,
  area text not null,               -- first 3 digits of the ZIP
  price numeric(10,2) not null,
  suggested numeric(10,2) not null,
  outcome text not null check (outcome in ('accepted','declined','countered','expired')),
  counter numeric(10,2),
  job_id uuid references public.jobs(id) on delete set null,
  contractor_id uuid references public.contractors(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.price_signals enable row level security;
create index if not exists price_signals_lookup_idx on public.price_signals (service_slug, area, created_at desc);

create table if not exists public.market_factors (
  service_slug text not null,
  area text not null default 'all',
  factor numeric(4,2) not null default 1 check (factor between 0.5 and 2),
  samples int not null default 0,
  target numeric(5,2),
  manual_factor numeric(4,2) check (manual_factor is null or manual_factor between 0.5 and 2),
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (service_slug, area)
);
alter table public.market_factors enable row level security;
create policy "market factors are public" on public.market_factors for select using (true);

-- Raising an offer / accepting a counter is its own payment kind.
alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check
  check (kind in ('deposit','final','milestone','plan','upfront','refund','balance','change_order','offer_raise','custom','materials','tip','gift_card','membership'));


-- >>> migration 20261003020600_pro_lead_engine.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261003020600_pro_lead_engine.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-03_0206 UTC
-- PURPOSE : Pro lead engine — find independent pros automatically and invite them:
--             • pro_leads         — businesses found (Google Places, CSV import of license lists)
--                                   with trade, area, rating, score, contact, outreach state
--             • pro_lead_events   — every email, click, call, reply, unsubscribe, conversion
--             • lead_engine_settings — one row: on/off, daily caps, trades, sequence timing
--           Email only (with unsubscribe and our postal address); phone-only leads go to a
--           human call list — never automated texts.
-- ============================================================================

create table if not exists public.pro_leads (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 18),
  source text not null check (source in ('google_places','csv','manual')),
  external_id text,                          -- Google place_id, license number…
  business_name text not null,
  contact_name text,
  trade text not null,
  area text,                                 -- ZIP3 or city
  zip text,
  city text,
  phone text,
  email text,
  website text,
  rating numeric(2,1),
  review_count int,
  license_number text,
  score int not null default 0,
  status text not null default 'new' check (status in ('new','queued','emailing','clicked','replied','applied','call','not_interested','unsubscribed','bounced','do_not_contact')),
  step int not null default 0,              -- emails sent so far
  next_send_at timestamptz,
  last_contact_at timestamptz,
  application_id uuid references public.contractor_applications(id) on delete set null,
  details_expire_at timestamptz,             -- Google content is refreshed/cleared after 30 days (their terms)
  notes text,
  created_at timestamptz not null default now(),
  unique (source, external_id)
);
alter table public.pro_leads enable row level security; -- server / staff only
create index if not exists pro_leads_due_idx on public.pro_leads (status, next_send_at);
create index if not exists pro_leads_email_idx on public.pro_leads (lower(email));
create index if not exists pro_leads_trade_idx on public.pro_leads (trade, area);

create table if not exists public.pro_lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.pro_leads(id) on delete cascade,
  kind text not null,
  note text,
  actor text,
  created_at timestamptz not null default now()
);
alter table public.pro_lead_events enable row level security;
create index if not exists pro_lead_events_lead_idx on public.pro_lead_events (lead_id, created_at desc);

create table if not exists public.lead_engine_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  discover_per_day int not null default 10,  -- Places searches per day (trade × area)
  emails_per_day int not null default 40,
  min_rating numeric(2,1) not null default 4.3,
  min_reviews int not null default 5,
  trades text[] not null default '{}',       -- empty = all trades with a supply gap
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.lead_engine_settings enable row level security;
insert into public.lead_engine_settings (id) values (1) on conflict do nothing;

alter table public.contractor_applications add column if not exists lead_id uuid references public.pro_leads(id) on delete set null;


-- >>> migration 20261003130300_crews_fast_track.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261003130300_crews_fast_track.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-03_1303 UTC
-- PURPOSE : Crew accounts and the proven-skill fast track.
--             • crew_members      — people a pro company sends to jobs (helpers, apprentices,
--                                   licensed techs). Each one who enters a customer's home passes
--                                   our background check first (Pro Agreement: helpers). The
--                                   company pays and directs them and handles their work
--                                   authorization, payroll and workers' comp (Crew Addendum).
--             • jobs.crew_member_id — who the company is sending (shown to the customer)
--             • contractors.crew_* — the owner's crew attestation (signed with the Crew Addendum)
--             • contractors.fast_track_* / tier_floor — a master of their trade sends a portfolio,
--                                   does one paid trial job we review, and starts at Pro+
-- ============================================================================

create table if not exists public.crew_members (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  full_name text not null check (length(full_name) between 2 and 120),
  phone text,
  email text,
  locale text not null default 'en' check (locale in ('en','es')),
  role text not null default 'helper' check (role in ('lead','helper','apprentice','licensed')),
  trades text[] not null default '{}',
  years_experience int check (years_experience is null or years_experience between 0 and 70),
  license_number text,
  background_status text not null default 'not_started' check (background_status in ('not_started','invited','pending','clear','consider','suspended','canceled')),
  background_provider_id text,
  background_checked_at timestamptz,
  active boolean not null default true,
  removed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.crew_members enable row level security;
create index if not exists crew_members_pro_idx on public.crew_members (contractor_id) where active;
create index if not exists crew_members_checkr_idx on public.crew_members (background_provider_id) where background_provider_id is not null;
create policy "pro reads own crew" on public.crew_members for select using (
  contractor_id in (select id from public.contractors where profile_id = auth.uid())
);
create policy staff_all on public.crew_members for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.jobs
  add column if not exists crew_member_id uuid references public.crew_members(id) on delete set null;

alter table public.contractors
  add column if not exists crew_attested_at timestamptz,
  add column if not exists crew_attestation jsonb,
  add column if not exists fast_track_status text not null default 'none'
    check (fast_track_status in ('none','applied','trial','approved','declined')),
  add column if not exists fast_track jsonb,
  add column if not exists fast_track_applied_at timestamptz,
  add column if not exists fast_track_trial_job_id uuid references public.jobs(id) on delete set null,
  add column if not exists fast_track_decided_at timestamptz,
  add column if not exists fast_track_decided_by text,
  add column if not exists fast_track_note text,
  add column if not exists tier_floor text check (tier_floor is null or tier_floor in ('pro_plus'));


-- >>> migration 20261004193200_business_growth.sql
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


-- >>> migration 20261004194900_retire_grocery.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261004194900_retire_grocery.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-04_1949 UTC
-- PURPOSE : Grocery pickup & delivery is no longer offered (replaced by Same-Day Courier). Its catalog row
--           stays for any past jobs but is marked inactive; the new courier row is added by the catalog sync.
-- ============================================================================
update public.services set active = false where slug = 'grocery-delivery';


-- >>> seed.sql
-- ============================================================================
-- FILE    : supabase/seed.sql   (generated by scripts/gen-seed.ts — do not hand edit)
-- PROJECT : Handled — AI-run home & business services
-- CREATED : 2026-10-04_1949 UTC
-- PURPOSE : PRODUCTION seed — service catalog + launch market. Safe to re-run.
-- ============================================================================

insert into public.services (slug, name, category, minimum, payout_share, site_visit, sort) values
  ('house-cleaning', 'House & Office Cleaning', 'cleaning', 120, 0.65, false, 0),
  ('window-cleaning', 'Window Cleaning', 'cleaning', 149, 0.65, false, 1),
  ('carpet-cleaning', 'Carpet & Upholstery Cleaning', 'cleaning', 129, 0.65, false, 2),
  ('organizing', 'Organizing & Decluttering', 'cleaning', 199, 0.65, false, 3),
  ('gutter-cleaning', 'Gutter Cleaning', 'cleaning', 149, 0.65, false, 4),
  ('power-washing', 'Power Washing', 'cleaning', 149, 0.7, false, 5),
  ('mobile-car-detailing', 'Mobile Car Detailing', 'cleaning', 79, 0.7, false, 6),
  ('lawn-care', 'Lawn Care', 'outdoor', 55, 0.7, false, 7),
  ('tree-removal', 'Tree Removal & Trimming', 'outdoor', 250, 0.75, true, 8),
  ('leaf-removal', 'Leaf Removal', 'outdoor', 125, 0.7, false, 9),
  ('snow-removal', 'Snow Removal', 'outdoor', 40, 0.7, false, 10),
  ('dog-walking', 'Dog Walking', 'pets', 22, 0.7, false, 11),
  ('dog-sitting', 'Dog Sitting & Pet Watching', 'pets', 28, 0.7, false, 12),
  ('pet-waste-removal', 'Dog Poop Removal', 'pets', 20, 0.7, false, 13),
  ('junk-removal', 'Junk Removal', 'removal', 129, 0.65, false, 14),
  ('large-item-removal', 'Large Item Removal', 'removal', 99, 0.65, false, 15),
  ('junk-container', 'Junk Container (Drop-off & Pickup)', 'removal', 349, 0.75, false, 16),
  ('small-moves', 'Small Moves & Moving Help', 'removal', 199, 0.7, false, 17),
  ('retail-delivery', 'Same-Day Large Item Delivery', 'removal', 89, 0.7, false, 18),
  ('staging-transport', 'Home Staging Furniture Moves', 'removal', 249, 0.7, false, 19),
  ('unit-turnover', 'Rental Unit Turnover', 'repair_remodel', 299, 0.7, false, 20),
  ('handyman', 'Handyman', 'repair_remodel', 99, 0.7, false, 21),
  ('plumbing', 'Plumbing Repairs', 'repair_remodel', 149, 0.7, false, 22),
  ('water-heater', 'Water Heater Replace & Repair', 'repair_remodel', 175, 0.75, false, 23),
  ('hvac-install', 'HVAC Installation', 'repair_remodel', 3500, 0.8, true, 24),
  ('lighting-install', 'Lighting & Ceiling Fan Install', 'repair_remodel', 149, 0.7, false, 25),
  ('camera-install', 'Security Camera Install', 'repair_remodel', 149, 0.7, false, 26),
  ('garbage-disposal', 'Garbage Disposal Repair & Replace', 'repair_remodel', 149, 0.7, false, 27),
  ('interior-painting', 'Interior Painting', 'repair_remodel', 349, 0.7, false, 28),
  ('exterior-painting', 'Exterior Painting', 'repair_remodel', 1200, 0.7, false, 29),
  ('bathroom-remodel', 'Bathroom Remodel', 'repair_remodel', 3500, 0.85, true, 30),
  ('kitchen-remodel', 'Kitchen Remodel', 'repair_remodel', 12000, 0.85, true, 31),
  ('home-remodel', 'Whole-Home Remodel', 'repair_remodel', 25000, 0.85, true, 32),
  ('errands', 'Errands & Pickups', 'errands', 39, 0.75, false, 33),
  ('courier', 'Same-Day Courier', 'errands', 25, 0.7, false, 34),
  ('medical-delivery', 'Medical Deliveries', 'errands', 29, 0.75, false, 35),
  ('personal-assistant', 'Personal Assistant for the Day', 'errands', 120, 0.75, false, 36),
  ('private-driver', 'Private Driver / Black Car', 'transport', 170, 0.8, false, 37),
  ('airport-transfer', 'Airport Transfer', 'transport', 95, 0.8, false, 38),
  ('limousine', 'Limousine', 'transport', 405, 0.8, false, 39),
  ('party-bus', 'Party Bus', 'transport', 900, 0.8, false, 40),
  ('charter-bus', 'Tour & Charter Bus', 'transport', 1100, 0.8, false, 41),
  ('game-day-rides', 'Game Day & Concert Rides', 'transport', 440, 0.8, false, 42),
  ('event-shuttle', 'Corporate & Event Shuttle', 'transport', 450, 0.8, false, 43),
  ('event-package', 'Plan My Event (by Budget)', 'events', 1000, 0.82, true, 44),
  ('event-planning', 'Event Planning & Coordination', 'events', 650, 0.75, true, 45),
  ('catering', 'Catering', 'events', 600, 0.8, false, 46),
  ('food-truck', 'Food Truck Booking', 'events', 1200, 0.8, false, 47),
  ('dj-music', 'DJ & Live Music', 'events', 450, 0.8, false, 48),
  ('event-rentals', 'Seating & Party Rentals', 'events', 250, 0.75, false, 49),
  ('event-venue', 'Event Space Rental & Coordination', 'events', 800, 0.85, true, 50)
on conflict (slug) do update set name = excluded.name, category = excluded.category, minimum = excluded.minimum,
  payout_share = excluded.payout_share, site_visit = excluded.site_visit, sort = excluded.sort;

insert into public.markets (name, state, zip_prefixes)
select 'Metro Detroit', 'MI', array['480','481','482','483'] where not exists (select 1 from public.markets where name = 'Metro Detroit');

