-- ============================================================================
-- FILE    : supabase/setup/HANDLED_SETUP_2026-10-22_0533.sql   (generated — do not hand edit)
-- PROJECT : Handled (HandledServices)
-- CREATED : 2026-10-22_0533 UTC
-- PURPOSE : One-paste setup for a NEW Supabase project: 80 migrations + production seed.
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
-- PROJECT : Handled (HandledServices) — AI-run home & business services
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
-- PROJECT : Handled (HandledServices) — AI-run home & business services
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
-- PROJECT : Handled (HandledServices) — AI-run home & business services
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
-- PROJECT : Handled (HandledServices) — AI-run home & business services
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
-- PROJECT : Handled (HandledServices) — AI-run home & business services
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
-- PROJECT : Handled (HandledServices) — AI-run home & business services
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
-- PROJECT : Handled (HandledServices) — AI-run home & business services
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
-- PROJECT : Handled (HandledServices) — AI-run home & business services
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
-- PROJECT : Handled (HandledServices) — AI-run home & business services
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
-- PROJECT : Handled (HandledServices) — AI-run home & business services
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
-- PROJECT : Handled (HandledServices) — AI-run home & business services
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
-- PROJECT : Handled (HandledServices) — AI-run home & business services
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
-- PROJECT : Handled (HandledServices) — AI-run home & business services
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
-- PROJECT : Handled (HandledServices) — AI-run home & business services
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
-- PROJECT : Handled (HandledServices) — AI-run home & business services
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
-- PROJECT : Handled (HandledServices) — AI-run home & business services
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
-- PROJECT : Handled (HandledServices) — AI-run home & business services
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
-- PROJECT : Handled (HandledServices) — AI-run home & business services
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
-- PROJECT : Handled (HandledServices) — AI-run home & business services
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
-- PROJECT : Handled (HandledServices) — AI-run home & business services
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
-- PROJECT : Handled (HandledServices) — AI-run home & business services
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
-- PROJECT : Handled (HandledServices) — AI-run home & business services
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
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-03_0049 UTC
-- PURPOSE : Contracts in Spanish: record the language each person read when they accepted.
--           The frozen copy (sections) also keeps the Spanish text they saw; English controls.
-- ============================================================================
alter table public.contract_acceptances
  add column if not exists locale text not null default 'en' check (locale in ('en','es'));


-- >>> migration 20261003011700_pro_fairness.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261003011700_pro_fairness.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
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
-- PROJECT : Handled (HandledServices) — AI-run home & business services
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
-- PROJECT : Handled (HandledServices) — AI-run home & business services
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
-- PROJECT : Handled (HandledServices) — AI-run home & business services
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
-- PROJECT : Handled (HandledServices) — AI-run home & business services
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
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-04_1949 UTC
-- PURPOSE : Grocery pickup & delivery is no longer offered (replaced by Same-Day Courier). Its catalog row
--           stays for any past jobs but is marked inactive; the new courier row is added by the catalog sync.
-- ============================================================================
update public.services set active = false where slug = 'grocery-delivery';


-- >>> migration 20261004220400_board_favorites.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261004220400_board_favorites.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-04_2204 UTC
-- PURPOSE : Open job board, customer favorites and crew member requests (packages/core/src/board.ts).
--             • job_offers.kind adds 'favorite' (a customer's favorite pro gets a first look) and
--               'board' (a pro claimed the job from "Jobs near you"; held while they read the work order)
--             • customer_favorites — any customer can favorite a pro, or a crew member of a pro company
--             • jobs.preferred_contractor_id / requested_crew_member_id — "Book again with …": the pro
--               gets a first look (never guaranteed); a crew member request goes to the company owner,
--               who decides who goes
--             • job_crew(job) — the customer's safe view of the crew member assigned to their job
-- ============================================================================

alter table public.job_offers drop constraint if exists job_offers_kind_check;
alter table public.job_offers add constraint job_offers_kind_check
  check (kind in ('job','recurring','redo','account','favorite','board'));

create table if not exists public.customer_favorites (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  crew_member_id uuid references public.crew_members(id) on delete cascade,
  service_slug text,
  created_at timestamptz not null default now()
);
create unique index if not exists customer_favorites_uniq
  on public.customer_favorites (customer_id, contractor_id, coalesce(crew_member_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists customer_favorites_pro_idx on public.customer_favorites (contractor_id);
alter table public.customer_favorites enable row level security;
create policy "customer reads own favorites" on public.customer_favorites for select to authenticated using (customer_id = auth.uid());
create policy "customer removes own favorites" on public.customer_favorites for delete to authenticated using (customer_id = auth.uid());
create policy staff_all on public.customer_favorites for all to authenticated using (public.is_staff()) with check (public.is_staff());
-- adding a favorite goes through the API (checks the customer actually had that pro)

alter table public.jobs
  add column if not exists preferred_contractor_id uuid references public.contractors(id) on delete set null,
  add column if not exists requested_crew_member_id uuid references public.crew_members(id) on delete set null;

-- Who from the company is coming? First name and role only — for the customer on that job.
create or replace function public.job_crew(p_job uuid)
returns table (crew_member_id uuid, first_name text, role text)
language sql stable security definer set search_path = public as $$
  select m.id, split_part(m.full_name, ' ', 1), m.role
  from public.jobs j join public.crew_members m on m.id = j.crew_member_id
  where j.id = p_job and (j.customer_id = auth.uid() or public.is_staff())
$$;
grant execute on function public.job_crew(uuid) to authenticated;


-- >>> migration 20261005012800_biz_job_posts.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261005012800_biz_job_posts.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-05_0130 UTC
-- PURPOSE : Business sales engine — job-posting track. A business that posted a job (Indeed and similar)
--           for a cleaner, handyman, maintenance tech, groundskeeper or mover is added by hand in the Hub
--           (job sites don't allow scraping) and gets the "book the work as a service" letter.
--             • biz_leads.job_title / posting_source / posting_url
--             • biz_leads.segment adds 'facilities' (offices, hotels & facilities)
-- ============================================================================
alter table public.biz_leads
  add column if not exists job_title text check (job_title is null or length(job_title) between 2 and 120),
  add column if not exists posting_source text check (posting_source is null or length(posting_source) <= 60),
  add column if not exists posting_url text check (posting_url is null or posting_url ~ '^https?://');
alter table public.biz_leads drop constraint if exists biz_leads_segment_check;
alter table public.biz_leads add constraint biz_leads_segment_check
  check (segment in ('property_manager','real_estate','stager','storage','retail','facilities'));


-- >>> migration 20261005014100_email_center.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261005014100_email_center.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-05_0148 UTC
-- PURPOSE : Email Center (Hub → Email): marketing campaigns sent from the company mailbox
--           (Hostinger SMTP, info@handledsvc.com), a trickle send by the 10-minute cron, click tracking,
--           and the shared unsubscribe list (email_optouts).
--             • email_campaigns            — draft → scheduled → sending → sent (or paused / cancelled)
--             • email_campaign_recipients  — one row per person per campaign (queued → sent / failed / skipped)
--             • email_center_settings      — sender name, reply-to, daily cap, per-run pace
--             • marketing_sends.kind adds 'campaign' (one marketing email a week per person, across all)
-- ============================================================================
create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  subject text not null default '',
  preheader text,
  body text not null default '',
  subject_es text,
  body_es text,
  audience text not null check (audience in ('customers','repeat_customers','lapsed_customers','business_accounts','biz_leads','pros','custom')),
  custom_list text,
  custom_consent boolean not null default false,
  status text not null default 'draft' check (status in ('draft','scheduled','sending','sent','paused','cancelled')),
  scheduled_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  recipients int not null default 0,
  sent int not null default 0,
  failed int not null default 0,
  skipped int not null default 0,
  clicks int not null default 0,
  unsubscribes int not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.email_campaigns enable row level security;
create policy staff_all on public.email_campaigns for all to authenticated using (public.is_staff()) with check (public.is_staff());
create index if not exists email_campaigns_status_idx on public.email_campaigns (status, scheduled_at);

create table if not exists public.email_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.email_campaigns(id) on delete cascade,
  email text not null check (email = lower(email) and position('@' in email) > 1),
  name text,
  locale text not null default 'en' check (locale in ('en','es')),
  vars jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued','sent','failed','skipped')),
  error text,
  sent_at timestamptz,
  clicked_at timestamptz,
  clicks int not null default 0,
  unique (campaign_id, email)
);
alter table public.email_campaign_recipients enable row level security;
create policy staff_all on public.email_campaign_recipients for all to authenticated using (public.is_staff()) with check (public.is_staff());
create index if not exists email_recipients_queue_idx on public.email_campaign_recipients (campaign_id, status);

create table if not exists public.email_center_settings (
  id int primary key default 1 check (id = 1),
  from_name text not null default 'Handled',
  reply_to text,
  daily_cap int not null default 250 check (daily_cap between 1 and 1000),
  per_run int not null default 25 check (per_run between 1 and 60),
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.email_center_settings enable row level security;
create policy staff_all on public.email_center_settings for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.marketing_sends drop constraint if exists marketing_sends_kind_check;
alter table public.marketing_sends add constraint marketing_sends_kind_check
  check (kind in ('seasonal','quote_followup','booking_followup','campaign'));


-- >>> migration 20261005021600_job_checklists.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261005021600_job_checklists.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-05_0221 UTC
-- PURPOSE : Job checklists (packages/core/src/checklists.ts): one format for every service.
--             • jobs.checklist        — the checklist frozen when a pro takes the job (text can't change mid-job)
--             • jobs.checklist_extra  — special instructions added to one job (staff, or a customer request
--                                       before the work starts): [{ id, text, required, from, at }]
--             • job_checklist_checks  — each item done or N/A (with the reason), by whom and when. The pro on
--                                       the job and the customer can read them; writes go through the API.
-- ============================================================================
alter table public.jobs
  add column if not exists checklist jsonb,
  add column if not exists checklist_extra jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist_extra) = 'array');

create table if not exists public.job_checklist_checks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  item_id text not null check (length(item_id) between 3 and 80),
  status text not null check (status in ('done','na')),
  note text check (note is null or length(note) <= 500),
  checked_by text,
  checked_at timestamptz not null default now(),
  unique (job_id, item_id),
  check (status <> 'na' or (note is not null and length(trim(note)) >= 3))
);
alter table public.job_checklist_checks enable row level security;
create index if not exists job_checklist_checks_job_idx on public.job_checklist_checks (job_id);
create policy "pro reads own job checks" on public.job_checklist_checks for select to authenticated using (
  exists (select 1 from public.jobs j where j.id = job_id and j.contractor_id = public.my_contractor_id())
);
create policy "customer reads own job checks" on public.job_checklist_checks for select to authenticated using (
  exists (select 1 from public.jobs j where j.id = job_id and j.customer_id = auth.uid())
);
create policy staff_all on public.job_checklist_checks for all to authenticated using (public.is_staff()) with check (public.is_staff());


-- >>> migration 20261005024000_pro_interviews.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261005024000_pro_interviews.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-05_0246 UTC
-- PURPOSE : Pro screening interviews (packages/core/src/interview.ts) between application and invite.
--             • pro_interviews — one per interview: AI (the candidate chats from a private link, after an AI
--               disclosure and consent) or a person (in person / phone, scored in the Hub). Transcript, scores
--               with evidence, the computed result, and the staff decision. A person always decides.
--             • contractor_applications.stage adds 'interviewing' and 'interviewed'
-- ============================================================================
create table if not exists public.pro_interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.contractor_applications(id) on delete cascade,
  token text not null unique default substr(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 1, 32),
  mode text not null default 'ai' check (mode in ('ai','human')),
  locale text not null default 'en' check (locale in ('en','es')),
  status text not null default 'invited' check (status in ('invited','in_progress','completed','expired','cancelled','human_requested')),
  plan jsonb not null default '[]'::jsonb,
  transcript jsonb not null default '[]'::jsonb,
  scores jsonb,
  evaluation jsonb,
  result text check (result is null or result in ('advance','follow_up','not_now')),
  average numeric(3,1),
  interviewer text,
  consent_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days',
  decision text check (decision is null or decision in ('invite','follow_up','decline')),
  decided_by text,
  decided_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.pro_interviews enable row level security; -- candidates reach it only through the token API
create policy staff_all on public.pro_interviews for all to authenticated using (public.is_staff()) with check (public.is_staff());
create index if not exists pro_interviews_app_idx on public.pro_interviews (application_id, created_at desc);

alter table public.contractor_applications drop constraint if exists contractor_applications_stage_check;
alter table public.contractor_applications add constraint contractor_applications_stage_check
  check (stage in ('applied','screened','interviewing','interviewed','invited','rejected','withdrawn'));


-- >>> migration 20261005041000_pro_rewards.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261005041000_pro_rewards.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-05_0418 UTC
-- PURPOSE : Handled Pro Rewards (packages/core/src/rewards.ts) — loyalty points for independent pros.
--             • reward_settings     — earn rate, point value, pending days… (Hub → Rewards)
--             • reward_ledger       — every point movement: earn (per job, pending → available), milestone,
--                                     redeem (negative), return (cancelled order), adjust, expire, forfeit
--             • reward_catalog      — what points buy (gear, gift cards, tools, electronics, trips); starter items below
--             • reward_redemptions  — orders: requested → approved → ordered → shipped → delivered (or cancelled);
--                                     fair market value goes on the pro's 1099 for the year it's delivered
--             • reward_balances     — view: available and pending points per pro
--           Pros read their own ledger and orders; the catalog is readable by signed-in users; writes go through the API.
-- ============================================================================
create table if not exists public.reward_settings (
  id int primary key default 1 check (id = 1),
  settings jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.reward_settings enable row level security;
create policy staff_all on public.reward_settings for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.reward_ledger (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  kind text not null check (kind in ('earn','milestone','redeem','return','adjust','expire','forfeit')),
  points int not null,
  status text not null default 'available' check (status in ('pending','available','void')),
  job_id uuid references public.jobs(id) on delete set null,
  redemption_id uuid,
  milestone text,
  available_at timestamptz,
  detail jsonb,
  note text,
  created_by text not null default 'system',
  created_at timestamptz not null default now()
);
create unique index if not exists reward_ledger_job_uniq on public.reward_ledger (contractor_id, job_id) where kind = 'earn';
create unique index if not exists reward_ledger_milestone_uniq on public.reward_ledger (contractor_id, milestone) where kind = 'milestone';
create index if not exists reward_ledger_pro_idx on public.reward_ledger (contractor_id, created_at desc);
create index if not exists reward_ledger_pending_idx on public.reward_ledger (available_at) where status = 'pending';
alter table public.reward_ledger enable row level security;
create policy "pro reads own rewards" on public.reward_ledger for select to authenticated using (contractor_id = public.my_contractor_id());
create policy staff_all on public.reward_ledger for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.reward_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  name_es text,
  category text not null check (category in ('merch','gift_card','tools','electronics','travel','experience')),
  points int not null check (points > 0),
  cost_usd numeric(10,2) not null check (cost_usd >= 0),
  description text,
  description_es text,
  image_url text,
  stock int check (stock is null or stock >= 0),
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.reward_catalog enable row level security;
create policy "signed-in users read the catalog" on public.reward_catalog for select to authenticated using (active or public.is_staff());
create policy staff_all on public.reward_catalog for all to authenticated using (public.is_staff()) with check (public.is_staff());
insert into public.reward_catalog (slug, name, name_es, category, points, cost_usd, description, description_es, sort) values
  ('hat', 'Handled hat', 'Gorra Handled', 'merch', 2500, 25, 'Embroidered cap.', 'Gorra bordada.', 0),
  ('tee', 'Handled T-shirt', 'Camiseta Handled', 'merch', 2500, 25, 'Heavyweight cotton tee.', 'Camiseta de algodón grueso.', 10),
  ('hoodie', 'Handled hoodie', 'Sudadera Handled', 'merch', 6000, 60, 'Warm pullover hoodie.', 'Sudadera cálida con capucha.', 20),
  ('jacket', 'Handled work jacket', 'Chamarra de trabajo Handled', 'merch', 12000, 120, 'Insulated, water-resistant.', 'Aislada y resistente al agua.', 30),
  ('gas-50', '$50 gas card', 'Tarjeta de gasolina de $50', 'gift_card', 5000, 50, 'For the miles you drive.', 'Para las millas que maneja.', 40),
  ('tools-100', '$100 tool store gift card', 'Tarjeta de regalo de $100 para ferretería', 'gift_card', 10000, 100, 'Home-improvement store gift card.', 'Tarjeta de una tienda de mejoras para el hogar.', 50),
  ('drill-kit', 'Cordless drill & driver kit', 'Kit de taladro y atornillador inalámbrico', 'tools', 20000, 200, 'Brushless, two batteries.', 'Sin escobillas, dos baterías.', 60),
  ('earbuds', 'Wireless earbuds', 'Audífonos inalámbricos', 'electronics', 15000, 150, 'Noise-cancelling.', 'Con cancelación de ruido.', 70),
  ('tv-55', '55" 4K TV', 'Televisión 4K de 55"', 'electronics', 45000, 450, 'Smart TV, delivered.', 'Smart TV, con entrega.', 80),
  ('tablet', 'Tablet', 'Tableta', 'electronics', 35000, 350, 'For quotes, photos and the app.', 'Para cotizaciones, fotos y la app.', 90),
  ('game-day', 'Detroit game-day tickets (2)', 'Boletos para un partido en Detroit (2)', 'experience', 30000, 300, 'Two tickets to a home game.', 'Dos boletos para un partido en casa.', 100),
  ('weekend-trip', 'Weekend getaway (2 nights)', 'Escapada de fin de semana (2 noches)', 'travel', 90000, 900, 'Hotel for two nights in Michigan or nearby.', 'Hotel por dos noches en Michigan o cerca.', 110),
  ('trip-for-two', '4-day trip for two', 'Viaje de 4 días para dos', 'travel', 200000, 2000, 'Flights and hotel, booked with you.', 'Vuelos y hotel, reservados con usted.', 120)
on conflict (slug) do nothing;

create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  item_id uuid references public.reward_catalog(id) on delete set null,
  item_name text not null,
  points int not null check (points > 0),
  fmv_usd numeric(10,2) not null check (fmv_usd >= 0),
  status text not null default 'requested' check (status in ('requested','approved','ordered','shipped','delivered','cancelled')),
  ship_to jsonb,
  tracking text,
  note text,
  delivered_at timestamptz,
  tax_year int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reward_redemptions_status_idx on public.reward_redemptions (status, created_at);
alter table public.reward_redemptions enable row level security;
create policy "pro reads own orders" on public.reward_redemptions for select to authenticated using (contractor_id = public.my_contractor_id());
create policy staff_all on public.reward_redemptions for all to authenticated using (public.is_staff()) with check (public.is_staff());

create or replace view public.reward_balances with (security_invoker = true) as
select contractor_id,
  coalesce(sum(points) filter (where status = 'available'), 0)::int as available,
  coalesce(sum(points) filter (where status = 'pending'), 0)::int as pending,
  coalesce(sum(points) filter (where kind in ('earn','milestone') and status <> 'void'), 0)::int as lifetime
from public.reward_ledger group by contractor_id;


-- >>> migration 20261005144100_gov_contracts.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261005144100_gov_contracts.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-05_1441 UTC
-- PURPOSE : Government contracts from SAM.gov (packages/core/src/gov-contracts.ts, Hub → Gov contracts).
--             • gov_settings       — the saved daily search: on/off, NAICS codes, state, keywords, notice types, days back,
--                                    daily API call budget, certifications we hold (for set-asides)
--             • gov_opportunities  — every notice we've pulled (cached so the 10-calls-a-day key goes far), its fit
--                                    score, our pipeline status (new → reviewing → bidding → submitted → won / lost,
--                                    or passed), notes, the full description and the AI bid summary
--             • gov_api_calls      — one row per SAM.gov call, to stay inside the daily budget
--             • gov_pro_interest   — pros we've asked about an opportunity and their answer (capacity, rate)
--           Staff only. The SAM.gov API key lives in Vercel (SAM_API_KEY), never in the database.
-- ============================================================================
create table if not exists public.gov_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  naics text[] not null default array['561720','561730','561790','561612','562111','484210']::text[],
  state text default 'MI',
  keywords text,
  ptypes text[] not null default array['o','k','p','r']::text[],
  days_back int not null default 7 check (days_back between 1 and 364),
  daily_call_budget int not null default 8 check (daily_call_budget between 1 and 1000),
  certifications text[] not null default '{}'::text[],
  last_run_at timestamptz,
  last_result jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.gov_settings enable row level security;
create policy staff_all on public.gov_settings for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.gov_opportunities (
  notice_id text primary key,
  title text not null,
  solicitation_number text,
  agency text,
  office text,
  notice_type text,
  ptype text,
  set_aside_code text,
  set_aside text,
  naics text,
  psc text,
  posted_date date,
  response_deadline timestamptz,
  archive_date date,
  active boolean not null default true,
  pop_city text,
  pop_state text,
  pop_zip text,
  ui_link text,
  description_url text,
  contacts jsonb not null default '[]'::jsonb,
  award_amount numeric,
  awardee text,
  fit_score int not null default 0,
  fit jsonb,
  services text[] not null default '{}'::text[],
  status text not null default 'new' check (status in ('new','reviewing','bidding','submitted','won','lost','passed')),
  owner text,
  notes text,
  description text,
  ai_summary jsonb,
  raw jsonb,
  first_seen timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gov_opportunities_fit on public.gov_opportunities (status, fit_score desc);
create index if not exists gov_opportunities_deadline on public.gov_opportunities (response_deadline);
alter table public.gov_opportunities enable row level security;
create policy staff_all on public.gov_opportunities for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.gov_api_calls (
  id bigserial primary key,
  called_at timestamptz not null default now(),
  kind text not null default 'search' check (kind in ('search','description')),
  query text,
  ok boolean not null default true,
  records int,
  error text,
  actor text not null default 'system'
);
create index if not exists gov_api_calls_day on public.gov_api_calls (called_at);
alter table public.gov_api_calls enable row level security;
create policy staff_all on public.gov_api_calls for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.gov_pro_interest (
  notice_id text not null references public.gov_opportunities(notice_id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  status text not null default 'asked' check (status in ('asked','interested','not_interested')),
  note text,
  asked_at timestamptz not null default now(),
  answered_at timestamptz,
  primary key (notice_id, contractor_id)
);
alter table public.gov_pro_interest enable row level security;
create policy staff_all on public.gov_pro_interest for all to authenticated using (public.is_staff()) with check (public.is_staff());

insert into public.gov_settings (id) values (1) on conflict (id) do nothing;


-- >>> migration 20261005195400_bid_engine.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261005195400_bid_engine.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-05_1954 UTC
-- PURPOSE : The bid engine (packages/core/src/bid-engine.ts, Hub → Bids): one workspace per public bid.
--             • bids             — the bid: source, agency, deadlines, status, go / no-go answers, pricing assumptions,
--                                  review sign-off, submission and result (our price, winning price, winner)
--             • bid_requirements — the compliance matrix: every "shall / must", form, deadline and attachment, with
--                                  where our response answers it and who checked it off
--             • bid_cost_lines   — the price lines (item, unit, quantity per year, years, pro cost, materials, last award)
--             • bid_pro_quotes   — pros' written prices per line and capacity, collected through a private link
--             • bid_documents    — the solicitation, addenda, price form, drafts and the submission confirmation
--                                  (private storage bucket "bids")
--             • bid_benchmarks   — what work went for before (award notices, bid tabs, our own results), for pricing
--           Staff only; pros reach their own quote only through the token link (server-side).
-- ============================================================================
create table if not exists public.bids (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  agency text,
  source text not null default 'other' check (source in ('sam','city','county','state','school','private','other')),
  notice_id text references public.gov_opportunities(notice_id) on delete set null,
  solicitation_number text,
  link text,
  due_at timestamptz,
  questions_due_at timestamptz,
  submit_method text,
  term_years numeric,
  status text not null default 'draft' check (status in ('draft','no_bid','pricing','review','ready','submitted','won','lost','cancelled')),
  go jsonb not null default '{}'::jsonb,
  no_bid_reason text,
  assumptions jsonb not null default '{}'::jsonb,
  margin_override boolean not null default false,
  ai_summary jsonb,
  owner text,
  review jsonb not null default '{}'::jsonb,
  reviewer text,
  reviewed_at timestamptz,
  submitted_at timestamptz,
  submitted_by text,
  our_price numeric,
  award_amount numeric,
  winning_price numeric,
  winner text,
  result_note text,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bids_status on public.bids (status, due_at);
alter table public.bids enable row level security;
create policy staff_all on public.bids for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.bid_requirements (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid not null references public.bids(id) on delete cascade,
  kind text not null default 'requirement' check (kind in ('eligibility','form','requirement','insurance','price_form','deadline','question','attachment','evaluation')),
  text text not null,
  source_ref text,
  response_ref text,
  required boolean not null default true,
  done boolean not null default false,
  done_by text,
  done_at timestamptz,
  note text,
  origin text not null default 'manual' check (origin in ('standard','ai','manual')),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists bid_requirements_bid on public.bid_requirements (bid_id, kind, sort);
alter table public.bid_requirements enable row level security;
create policy staff_all on public.bid_requirements for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.bid_cost_lines (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid not null references public.bids(id) on delete cascade,
  item text not null,
  unit text not null default 'each',
  qty numeric not null default 0 check (qty >= 0),
  years numeric not null default 1 check (years >= 0),
  pro_unit_cost numeric check (pro_unit_cost is null or pro_unit_cost >= 0),
  materials_unit numeric not null default 0 check (materials_unit >= 0),
  benchmark numeric check (benchmark is null or benchmark >= 0),
  slug text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists bid_cost_lines_bid on public.bid_cost_lines (bid_id, sort);
alter table public.bid_cost_lines enable row level security;
create policy staff_all on public.bid_cost_lines for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.bid_pro_quotes (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid not null references public.bids(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  token text not null unique,
  status text not null default 'asked' check (status in ('asked','committed','declined')),
  prices jsonb not null default '{}'::jsonb,
  capacity text,
  small_business boolean,
  note text,
  asked_at timestamptz not null default now(),
  answered_at timestamptz,
  unique (bid_id, contractor_id)
);
alter table public.bid_pro_quotes enable row level security;
create policy staff_all on public.bid_pro_quotes for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.bid_documents (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid not null references public.bids(id) on delete cascade,
  kind text not null default 'other' check (kind in ('rfq','addendum','price_form','draft','confirmation','other')),
  name text not null,
  path text not null,
  size int,
  ai_read_at timestamptz,
  uploaded_by text,
  created_at timestamptz not null default now()
);
create index if not exists bid_documents_bid on public.bid_documents (bid_id, created_at);
alter table public.bid_documents enable row level security;
create policy staff_all on public.bid_documents for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.bid_benchmarks (
  id uuid primary key default gen_random_uuid(),
  item text not null,
  unit text not null,
  price numeric not null check (price >= 0),
  agency text,
  source text,
  award_date date,
  bid_id uuid references public.bids(id) on delete set null,
  note text,
  created_by text,
  created_at timestamptz not null default now()
);
alter table public.bid_benchmarks enable row level security;
create policy staff_all on public.bid_benchmarks for all to authenticated using (public.is_staff()) with check (public.is_staff());

insert into storage.buckets (id, name, public) values ('bids', 'bids', false) on conflict (id) do nothing;


-- >>> migration 20261005203400_handled_talent.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261005203400_handled_talent.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-05_2034 UTC
-- PURPOSE : Handled Talent — recruiting agency as a service (packages/core/src/talent.ts; Hub → Talent; /pro/talent).
--             • talent_clients           — companies that hire through us, their fee terms and signed agreement
--             • talent_searches          — job orders (contingency or retained), the client review link, fair-hiring flags
--             • talent_search_recruiters — independent recruiters (pros with the "recruiter" trade) on each search
--             • talent_candidates        — candidates, résumé, consent to be represented, the recruiter who found them
--             • talent_submissions       — a candidate on a search: stage, write-up, client feedback, offer, start date;
--                                          first written submission owns the candidate for that client for 12 months
--             • talent_events            — the activity log for each submission
--             • talent_placements        — hires: salary, fee, recruiter / Handled split, invoice, payment, guarantee
--             • talent_retainer_payments — the three retained payments per retained search
--           Payouts to recruiters go through the existing payouts table (kind 'placement') and the weekly Stripe run;
--           client invoices through payments (kind 'invoice') and the Stripe webhook.
--           Staff manage everything; recruiters reach their own searches and candidates through the API (server-side);
--           clients review candidates through their search's private link. Résumés live in the private "talent" bucket.
-- ============================================================================
create table if not exists public.talent_clients (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  contact_name text not null,
  email text not null,
  phone text,
  website text,
  industry text,
  city text,
  business_account_id uuid references public.business_accounts(id) on delete set null,
  terms jsonb not null default '{}'::jsonb,
  status text not null default 'prospect' check (status in ('prospect','active','inactive')),
  agreement_version text,
  agreement_signed_at timestamptz,
  agreement_signed_by text,
  agreement_ip text,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists talent_clients_email on public.talent_clients (lower(email));
alter table public.talent_clients enable row level security;
create policy staff_all on public.talent_clients for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.talent_searches (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.talent_clients(id) on delete cascade,
  title text not null,
  location text,
  workplace text not null default 'onsite' check (workplace in ('onsite','hybrid','remote')),
  salary_min numeric check (salary_min is null or salary_min >= 0),
  salary_max numeric check (salary_max is null or salary_max >= 0),
  openings int not null default 1 check (openings between 1 and 100),
  description text,
  must_haves text,
  type text not null default 'contingency' check (type in ('contingency','retained')),
  fee_pct numeric not null check (fee_pct > 0 and fee_pct <= 50),
  recruiter_pct numeric not null check (recruiter_pct >= 0),
  minimum_fee numeric not null default 0 check (minimum_fee >= 0),
  estimated_salary numeric,
  engaged_on date,
  exclusive boolean not null default false,
  status text not null default 'intake' check (status in ('intake','open','on_hold','filled','cancelled')),
  review_token text not null unique,
  fair_flags jsonb not null default '[]'::jsonb,
  fair_override text,
  created_by text,
  created_at timestamptz not null default now(),
  filled_at timestamptz,
  check (recruiter_pct <= fee_pct)
);
create index if not exists talent_searches_status on public.talent_searches (status, created_at desc);
alter table public.talent_searches enable row level security;
create policy staff_all on public.talent_searches for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.talent_search_recruiters (
  search_id uuid not null references public.talent_searches(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  role text not null default 'support' check (role in ('lead','support')),
  assigned_at timestamptz not null default now(),
  primary key (search_id, contractor_id)
);
alter table public.talent_search_recruiters enable row level security;
create policy staff_all on public.talent_search_recruiters for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.talent_candidates (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  location text,
  current_title text,
  linkedin text,
  resume_path text,
  summary text,
  source text,
  owner_contractor_id uuid references public.contractors(id) on delete set null,
  consent_at timestamptz,
  consent_method text,
  do_not_contact boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists talent_candidates_email on public.talent_candidates (lower(email));
alter table public.talent_candidates enable row level security;
create policy staff_all on public.talent_candidates for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.talent_submissions (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.talent_searches(id) on delete cascade,
  client_id uuid not null references public.talent_clients(id) on delete cascade,
  candidate_id uuid not null references public.talent_candidates(id) on delete cascade,
  recruiter_id uuid references public.contractors(id) on delete set null,
  stage text not null default 'sourced' check (stage in ('sourced','screened','submitted','client_review','interview','offer','placed','rejected','withdrawn')),
  pitch text,
  expected_salary numeric,
  submitted_at timestamptz,
  candidate_confirm_token text unique,
  candidate_confirmed_at timestamptz,
  client_feedback text,
  client_decision text check (client_decision in ('interview','pass','hold')),
  interview_at timestamptz,
  offer_salary numeric,
  start_date date,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (search_id, candidate_id)
);
create index if not exists talent_submissions_owner on public.talent_submissions (client_id, candidate_id, submitted_at);
alter table public.talent_submissions enable row level security;
create policy staff_all on public.talent_submissions for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.talent_events (
  id bigserial primary key,
  submission_id uuid references public.talent_submissions(id) on delete cascade,
  search_id uuid references public.talent_searches(id) on delete cascade,
  actor text not null,
  kind text not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists talent_events_sub on public.talent_events (submission_id, created_at);
alter table public.talent_events enable row level security;
create policy staff_all on public.talent_events for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.talent_placements (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.talent_submissions(id) on delete restrict,
  search_id uuid not null references public.talent_searches(id) on delete restrict,
  client_id uuid not null references public.talent_clients(id) on delete restrict,
  candidate_id uuid not null references public.talent_candidates(id) on delete restrict,
  recruiter_id uuid references public.contractors(id) on delete set null,
  base_salary numeric not null check (base_salary > 0),
  fee_pct numeric not null,
  fee numeric not null check (fee >= 0),
  recruiter_pay numeric not null check (recruiter_pay >= 0),
  platform numeric not null,
  start_date date not null,
  invoice_number text unique,
  invoice_due date,
  payment_url text,
  amount_paid numeric not null default 0,
  paid_at timestamptz,
  status text not null default 'pending_start' check (status in ('pending_start','invoiced','paid','guarantee_claim','replaced','refunded','void')),
  guarantee_ends date,
  exit_date date,
  exit_reason text,
  remedy text check (remedy in ('replacement','refund')),
  refund numeric not null default 0,
  created_by text,
  created_at timestamptz not null default now()
);
alter table public.talent_placements enable row level security;
create policy staff_all on public.talent_placements for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.talent_retainer_payments (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.talent_searches(id) on delete cascade,
  key text not null check (key in ('engagement','shortlist','placement')),
  amount numeric not null check (amount >= 0),
  recruiter_pay numeric not null default 0 check (recruiter_pay >= 0),
  recruiter_id uuid references public.contractors(id) on delete set null,
  due date,
  status text not null default 'scheduled' check (status in ('scheduled','invoiced','paid','void')),
  invoice_number text unique,
  payment_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (search_id, key)
);
alter table public.talent_retainer_payments enable row level security;
create policy staff_all on public.talent_retainer_payments for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- recruiter pay rides the existing payout run (weekly Stripe transfers, statements, 1099s)
alter table public.payouts drop constraint if exists payouts_kind_check;
alter table public.payouts add constraint payouts_kind_check
  check (kind in ('job','show_up','guarantee','stipend','materials','clawback','referral','tip','placement'));
alter table public.payouts add column if not exists talent_placement_id uuid references public.talent_placements(id) on delete set null;
alter table public.payouts add column if not exists talent_retainer_id uuid references public.talent_retainer_payments(id) on delete set null;
create unique index if not exists payouts_talent_placement_once on public.payouts (talent_placement_id) where kind = 'placement' and talent_placement_id is not null;
create unique index if not exists payouts_talent_retainer_once on public.payouts (talent_retainer_id) where kind = 'placement' and talent_retainer_id is not null;

-- client invoices settle through the Stripe webhook
alter table public.payments add column if not exists talent_placement_id uuid references public.talent_placements(id) on delete set null;
alter table public.payments add column if not exists talent_retainer_id uuid references public.talent_retainer_payments(id) on delete set null;

insert into storage.buckets (id, name, public) values ('talent', 'talent', false) on conflict (id) do nothing;


-- >>> migration 20261005203900_bid_archive.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261005203900_bid_archive.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-05_2043 UTC
-- PURPOSE : RFP / RFQ archive and resubmission (bid engine, Hub → Bids).
--             • bids: solicitation type (RFQ, RFP, IFB…), revision number, reopened for a revision (when / why),
--               and the earlier bid it was copied from (next year's re-bid)
--             • bid_documents: versions — replacing a file keeps the old one (superseded, never deleted)
--             • bid_submissions: every time a bid is submitted, a frozen record: number, reason, what changed, the
--               exact pricing, compliance matrix, review sign-off and the documents sent, plus the confirmation
-- ============================================================================
alter table public.bids add column if not exists solicitation_type text not null default 'rfq'
  check (solicitation_type in ('rfq','rfp','ifb','rfi','sources_sought','other'));
alter table public.bids add column if not exists revision int not null default 0;
alter table public.bids add column if not exists reopened_at timestamptz;
alter table public.bids add column if not exists reopen_reason text;
alter table public.bids add column if not exists reopen_note text;
alter table public.bids add column if not exists previous_bid_id uuid references public.bids(id) on delete set null;
create index if not exists bids_search on public.bids (solicitation_type, status, created_at desc);

alter table public.bid_documents add column if not exists version int not null default 1;
alter table public.bid_documents add column if not exists superseded_at timestamptz;
alter table public.bid_documents add column if not exists superseded_by uuid references public.bid_documents(id) on delete set null;
alter table public.bid_documents add column if not exists note text;

create table if not exists public.bid_submissions (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid not null references public.bids(id) on delete cascade,
  number int not null check (number >= 1),
  reason text not null default 'initial' check (reason in ('initial','correction','addendum','agency_request','bafo','price_update')),
  change_note text,
  submitted_at timestamptz not null default now(),
  submitted_by text not null,
  our_price numeric,
  snapshot jsonb not null,
  document_ids uuid[] not null default '{}',
  confirmation_doc_id uuid references public.bid_documents(id) on delete restrict,
  unique (bid_id, number)
);
alter table public.bid_submissions enable row level security;
create policy staff_all on public.bid_submissions for all to authenticated using (public.is_staff()) with check (public.is_staff());
-- a submission record is evidence: it can't be edited after the fact
create or replace function public.bid_submission_frozen() returns trigger language plpgsql as $$
begin raise exception 'Submission records are permanent — submit a new version instead'; end $$;
drop trigger if exists bid_submission_frozen on public.bid_submissions;
create trigger bid_submission_frozen before update on public.bid_submissions for each row execute function public.bid_submission_frozen();


-- >>> migration 20261005213400_biz_lead_partners.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261005213400_biz_lead_partners.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-05_2134 UTC
-- PURPOSE : Business leads can be teaming partners (segment 'partner'): firms we bid public contracts with.
--           Tracked in Hub → Business leads, never discovered, emailed by the sales sequence or included in
--           Email Center blasts (enforced in lib/biz-leads.ts and lib/email-center.ts).
-- ============================================================================
alter table public.biz_leads drop constraint if exists biz_leads_segment_check;
alter table public.biz_leads add constraint biz_leads_segment_check
  check (segment in ('property_manager','real_estate','stager','storage','retail','facilities','partner'));


-- >>> migration 20261005213900_account_notes.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261005213900_account_notes.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-05_2141 UTC
-- PURPOSE : Account notes — the running conversation history for every business lead, business account and
--           Handled Talent client: notes, calls, emails, meetings and texts, each with who wrote it and when.
--           Append-only: a note is never edited or deleted (the database refuses), so the history stays complete;
--           a correction is a new note. Status changes and automated events stay in biz_lead_events and are shown
--           in the same timeline.
-- ============================================================================
create table if not exists public.account_notes (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('biz_lead','business_account','talent_client')),
  subject_id uuid not null,
  kind text not null default 'note' check (kind in ('note','call','email','meeting','text','status')),
  body text not null check (length(trim(body)) between 1 and 8000),
  author text not null,
  created_at timestamptz not null default now()
);
create index if not exists account_notes_subject on public.account_notes (subject_type, subject_id, created_at desc);
alter table public.account_notes enable row level security;
create policy staff_read on public.account_notes for select to authenticated using (public.is_staff());
create policy staff_add on public.account_notes for insert to authenticated with check (public.is_staff());

create or replace function public.account_notes_append_only() returns trigger language plpgsql as $$
begin raise exception 'Account notes are permanent — add a new note instead of changing or deleting one'; end $$;
drop trigger if exists account_notes_append_only on public.account_notes;
create trigger account_notes_append_only before update or delete on public.account_notes for each row execute function public.account_notes_append_only();

-- keep what's already written: each lead's existing notes become its first history entry
insert into public.account_notes (subject_type, subject_id, kind, body, author, created_at)
select 'biz_lead', l.id, 'note', l.notes, 'imported', l.created_at
from public.biz_leads l
where l.notes is not null and length(trim(l.notes)) > 0
  and not exists (select 1 from public.account_notes n where n.subject_type = 'biz_lead' and n.subject_id = l.id);


-- >>> migration 20261005214500_customer_notes.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261005214500_customer_notes.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-05_2146 UTC
-- PURPOSE : Customer notes — the same permanent, append-only history now covers homeowner / walk-in customers.
--           A customer is keyed by their email: subject_id = md5(lower(trim(email)))::uuid, so every booking
--           under that email shares one history (the app computes the same id).
-- ============================================================================
alter table public.account_notes drop constraint if exists account_notes_subject_type_check;
alter table public.account_notes add constraint account_notes_subject_type_check
  check (subject_type in ('biz_lead','business_account','talent_client','customer'));

create or replace function public.customer_subject_id(email text) returns uuid language sql immutable as $$
  select md5(lower(trim(email)))::uuid
$$;


-- >>> migration 20261006032400_factoring_partners.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261006032400_factoring_partners.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-06_0324 UTC
-- PURPOSE : Invoice factoring partners (packages/core/src/factoring.ts, Hub → Factoring): the companies we're asking
--           to fund net-30+ business, city and government invoices so weekly pro payouts stay on time. One row per
--           partner with the outreach status and the quote (advance rate, fee, recourse, minimums, term, fees).
--           Seeded with the five partners from docs/FACTORING_COMPARISON_2026-10-06_0320.xlsx (web search, verify on
--           the call). Staff only. No contract or bank details are stored here.
-- ============================================================================
create table if not exists public.factoring_partners (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  website text,
  fit text,
  sort int not null default 100,
  status text not null default 'to_contact'
    check (status in ('to_contact','emailed','call_scheduled','quote_received','applied','active','passed')),
  gov_scope text,                                   -- which receivables they fund: federal / state / city
  advance_rate numeric check (advance_rate is null or (advance_rate > 0 and advance_rate <= 1)),
  fee_pct numeric check (fee_pct is null or (fee_pct >= 0 and fee_pct < 1)),
  fee_period_days int check (fee_period_days is null or fee_period_days between 1 and 90),
  days_to_fund int check (days_to_fund is null or days_to_fund between 0 and 60),
  recourse text check (recourse is null or recourse in ('recourse','non_recourse')),
  monthly_minimum numeric check (monthly_minimum is null or monthly_minimum >= 0),
  term text,                                        -- contract length / auto-renew / early-exit fee
  spot_factoring boolean,
  other_fees text,
  contact_name text,
  contact_email text,
  contact_phone text,
  contacted_at date,
  notes text,
  updated_by text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.factoring_partners enable row level security;
create policy staff_all on public.factoring_partners for all to authenticated using (public.is_staff()) with check (public.is_staff());

insert into public.factoring_partners (slug, name, website, fit, sort) values
  ('advance-partners', 'Advance Partners', 'https://www.advancepartners.com/payroll-funding/government-staffing/',
   'Payroll funding for staffing on government contracts, including municipal; back office for payroll and billing. Best fit for the weekly pro payout run.', 10),
  ('1st-commercial-credit', '1st Commercial Credit', 'https://www.1stcommercialcredit.com/financial-services/government-receivables',
   'Dedicated government-receivables program plus staffing and payroll funding; works with small businesses.', 20),
  ('porter-capital', 'Porter Capital', 'https://portercap.com/government-invoice-factoring',
   'Long-time government contractor factoring; covers service and staffing businesses.', 30),
  ('ecapital', 'eCapital', 'https://ecapital.com/blog/using-government-contractor-financing-to-bridge-cash-flow-gaps',
   'Large lender with government contractor financing; can grow into an asset-based credit line for bigger contracts.', 40),
  ('8a-factoring', '8A Factoring', 'https://www.8afactoring.com',
   'Government invoices for small and 8(a) / minority-owned businesses; fits set-aside and MBE/DBE work.', 50)
on conflict (slug) do nothing;


-- >>> migration 20261006070800_app_payments.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261006070800_app_payments.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-06_0708 UTC
-- PURPOSE : In-app payments (Apple Pay, Google Pay, card via Stripe PaymentSheet): a payment row
--           remembers its PaymentIntent, so the webhook can settle it and support can look it up.
-- ============================================================================
alter table public.payments add column if not exists stripe_payment_intent_id text;
create index if not exists payments_stripe_payment_intent_idx on public.payments (stripe_payment_intent_id) where stripe_payment_intent_id is not null;


-- >>> migration 20261006072600_lock_down_rpc.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261006072600_lock_down_rpc.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-06_0726 UTC
-- PURPOSE : Security (defense in depth): functions that run with elevated rights (security definer) are
--           not callable from the app unless they're meant to be. Supabase exposes the public schema as
--           RPC, so an un-revoked function can be called with the public (anon) key.
--             • recompute_contractor_rating(cid) — was callable by anyone (it only recomputes from existing
--               reviews, so harmless, but it isn't the app's business). Now server-only.
--             • draw_promo_balance(code, amount) — already revoked in launch_growth; re-asserted here and
--               granted explicitly to the server (service_role) so it can't be lost by accident.
--           Helpers that only answer about the caller (is_staff, app_role, my_contractor_id) and the
--           customer's own-job lookups (job_pro, job_crew) stay callable by signed-in users.
--           New functions in this schema are no longer executable by anonymous users by default.
-- ============================================================================
revoke all on function public.draw_promo_balance(text, numeric) from public, anon, authenticated;
grant execute on function public.draw_promo_balance(text, numeric) to service_role;

revoke all on function public.recompute_contractor_rating(uuid) from public, anon, authenticated;
grant execute on function public.recompute_contractor_rating(uuid) to service_role;

alter default privileges in schema public revoke execute on functions from public, anon;


-- >>> migration 20261006075200_agent_tasks.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261006075200_agent_tasks.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-06_0752 UTC
-- PURPOSE : Tasks the team assigns to the AI agents (Hub → AI agents, or by asking the Ops co-pilot).
--           Each open task is added to that agent's instructions on every run (packages/core/src/mission.ts),
--           and the morning brief reports progress on all of them. agent = the agent's kind
--           (concierge, dispatch, daily_brief…) or 'all' for every agent. Staff only.
-- ============================================================================
create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  agent text not null check (agent ~ '^[a-z_]{2,40}$'),
  title text not null check (char_length(title) between 3 and 300),
  target text check (target is null or char_length(target) <= 200),
  due_date date,
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  note text check (note is null or char_length(note) <= 1000),
  created_by text,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists agent_tasks_open on public.agent_tasks (agent) where status = 'open';

alter table public.agent_tasks enable row level security;
drop policy if exists staff_all on public.agent_tasks;
create policy staff_all on public.agent_tasks for all to authenticated using (public.is_staff()) with check (public.is_staff());


-- >>> migration 20261006084100_business_rfp_scope.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261006084100_business_rfp_scope.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-06_0841 UTC
-- PURPOSE : The business Request for Proposal keeps its scope of work as structured data (packages/core/src/rfp.ts):
--           square footage, site, each service with how often and specifics, working hours, current vendor, term,
--           decision process (and bid due date), walkthrough times, preferred contact. The Hub shows it with a
--           follow-up checklist of what's still missing.
-- ============================================================================
alter table public.business_accounts
  add column if not exists rfp_scope jsonb,
  add column if not exists preferred_contact text check (preferred_contact is null or preferred_contact in ('call','email','text'));


-- >>> migration 20261006195000_job_coverage.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261006195000_job_coverage.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-06_1950 UTC
-- PURPOSE : Every job gets done (packages/core/src/coverage.ts).
--             • job_backups — backup #1, #2, #3 lined up behind the pro on every accepted job. Status:
--                 asked (we asked) → standby (they confirmed they can cover) → called (the pro dropped; their turn)
--                 → promoted (they took the job) · declined / passed (said no) · released (job done or cancelled)
--             • job_offers.kind adds 'backup' (the call that goes to a backup when the pro drops)
--             • pro_standing_events.kind adds 'short_notice_cancel' (6–24h: logged, no penalty) and 'excused_cancel'
--             • jobs.handoffs — how many times the job changed pros (shown to staff)
-- ============================================================================
create table if not exists public.job_backups (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  rank int not null check (rank between 1 and 3),
  status text not null default 'asked' check (status in ('asked','standby','called','declined','passed','promoted','released')),
  asked_at timestamptz not null default now(),
  responded_at timestamptz,
  called_at timestamptz,
  unique (job_id, contractor_id)
);
create index if not exists job_backups_job_idx on public.job_backups (job_id, rank);
create index if not exists job_backups_pro_idx on public.job_backups (contractor_id, status);

alter table public.job_backups enable row level security;
drop policy if exists "pro reads own backups" on public.job_backups;
create policy "pro reads own backups" on public.job_backups for select to authenticated using (contractor_id = public.my_contractor_id());
drop policy if exists staff_all on public.job_backups;
create policy staff_all on public.job_backups for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.job_offers drop constraint if exists job_offers_kind_check;
alter table public.job_offers add constraint job_offers_kind_check
  check (kind in ('job','recurring','redo','account','favorite','board','backup'));

alter table public.pro_standing_events drop constraint if exists pro_standing_events_kind_check;
alter table public.pro_standing_events add constraint pro_standing_events_kind_check
  check (kind in ('late_cancel','short_notice_cancel','excused_cancel','no_show','warning','suspension','deactivation','appeal','appeal_upheld','reinstated','note'));

alter table public.jobs add column if not exists handoffs int not null default 0;


-- >>> migration 20261006201000_pro_business_address.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261006201000_pro_business_address.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-06_2010 UTC
-- PURPOSE : A pro's place of business (street, city, state, ZIP). Dispatch measures driving distance from it
--           (geocoded street address; ZIP centre when the lookup isn't available — base_located says which).
-- ============================================================================
alter table public.contractors
  add column if not exists base_address text,
  add column if not exists base_city text,
  add column if not exists base_state text check (base_state is null or base_state ~ '^[A-Z]{2}$'),
  add column if not exists base_located text check (base_located is null or base_located in ('address','zip'));


-- >>> migration 20261006212000_cancellation_tracking.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261006212000_cancellation_tracking.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-06_2120 UTC
-- PURPOSE : Track every cancellation, not just the ones that count against a pro:
--             pro_standing_events.kind adds 'free_cancel' (handed back 24h+ ahead - recorded, never counted).
--           Hub -> Cancellations & coverage and the pro's own record read these.
-- ============================================================================
alter table public.pro_standing_events drop constraint if exists pro_standing_events_kind_check;
alter table public.pro_standing_events add constraint pro_standing_events_kind_check
  check (kind in ('late_cancel','short_notice_cancel','free_cancel','excused_cancel','no_show','warning','suspension','deactivation','appeal','appeal_upheld','reinstated','note'));
create index if not exists pro_standing_kind_idx on public.pro_standing_events (kind, created_at desc);


-- >>> migration 20261006215500_xero_accounting.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261006215500_xero_accounting.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-06_2155 UTC
-- PURPOSE : Xero is the books of record; Stripe is where the money moves. This adds:
--             xero_connection    - the one connected Xero organisation: OAuth tokens (encrypted by the server,
--                                  never readable from the browser: RLS on, no policies) and the account mapping.
--             xero_sync_log      - one row per document pushed to Xero (daily Stripe summaries, payouts to the
--                                  bank, pro payout spends, business invoices and their payments). The unique
--                                  (kind, ref) makes every push happen once; a failed push is retried.
--             payments.tax_amount             - sales tax Stripe Tax added on top (kept out of revenue).
--             business_invoices.xero_invoice_id, business_accounts.xero_contact_id, contractors.xero_contact_id.
--           Hub -> Accounting (Xero) reads these. Safe to run twice.
-- ============================================================================
create table if not exists public.xero_connection (
  id int primary key default 1 check (id = 1),
  tenant_id text,
  tenant_name text,
  connection_id text,
  access_token text,            -- encrypted (AES-256-GCM) by apps/web/lib/xero.ts
  refresh_token text,           -- encrypted; Xero rotates it on every refresh (60-day life)
  expires_at timestamptz,
  scopes text,
  settings jsonb not null default '{}'::jsonb,   -- account codes, sync start date, reconcile flag
  connected_by text,
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.xero_connection enable row level security;
-- no policies on purpose: only the server (service role) reads or writes tokens

create table if not exists public.xero_sync_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('stripe_day','stripe_receive','stripe_spend','pro_payout','bank_payout','invoice','invoice_payment','invoice_void')),
  ref text not null,                 -- e.g. 2026-10-05, 2026-10-05:po_123, invoice id
  day date,                          -- the business day it belongs to (America/Detroit)
  status text not null default 'pending' check (status in ('pending','done','error','skipped')),
  xero_id text,                      -- BankTransactionID / BankTransferID / InvoiceID / PaymentID
  amount numeric(12,2),
  detail jsonb,
  error text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, ref)
);
create index if not exists xero_sync_log_day_idx on public.xero_sync_log (day desc, kind);
create index if not exists xero_sync_log_status_idx on public.xero_sync_log (status, updated_at desc);
alter table public.xero_sync_log enable row level security;
drop policy if exists staff_read on public.xero_sync_log;
create policy staff_read on public.xero_sync_log for select to authenticated using (public.is_staff());

alter table public.payments add column if not exists tax_amount numeric(12,2) not null default 0;
create index if not exists payments_pi_idx on public.payments (stripe_payment_intent_id) where stripe_payment_intent_id is not null;
create index if not exists payments_session_idx on public.payments (stripe_session_id) where stripe_session_id is not null;
alter table public.business_invoices add column if not exists xero_invoice_id text;
alter table public.business_accounts add column if not exists xero_contact_id text;
alter table public.contractors add column if not exists xero_contact_id text;


-- >>> migration 20261007010000_referral_partners.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261007010000_referral_partners.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-07_0100 UTC
-- PURPOSE : Referral Partner Program. Anyone signs up, shares a link or sends us a customer, and earns 10% of
--           Handled's take on that customer's completed jobs for 12 months, paid weekly via Stripe Connect after
--           the 30-day make-it-right window (rules: packages/core/src/partners.ts).
--             referral_partners    - the partner, their code, payout account, terms acceptance
--             referral_customers   - which partner a customer belongs to (one partner per customer email) and until when
--             partner_commissions  - one row per completed referred job: pending -> paid (or void)
--             jobs.partner_id      - the partner a job is credited to
--           Staff read/write through the Hub; partners see their own data through the server. Safe to run twice.
-- ============================================================================
create table if not exists public.referral_partners (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  email text not null unique,
  phone text,
  company text,
  kind text not null default 'other' check (kind in ('realtor','property_manager','contractor','business','customer','pro','other')),
  how text,                                  -- how they plan to refer
  status text not null default 'active' check (status in ('active','suspended')),
  profile_id uuid references public.profiles(id) on delete set null,
  stripe_account_id text,
  xero_contact_id text,
  terms_version text,
  terms_accepted_at timestamptz,
  terms_ip text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.referral_customers (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.referral_partners(id) on delete cascade,
  customer_email text not null unique,       -- lower-case; first partner wins
  customer_name text,
  customer_phone text,
  service_slug text,
  note text,
  source text not null default 'link' check (source in ('link','direct','staff')),
  first_job_id uuid references public.jobs(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists referral_customers_partner_idx on public.referral_customers (partner_id);

create table if not exists public.partner_commissions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.referral_partners(id) on delete cascade,
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  take numeric(12,2) not null,
  amount numeric(12,2) not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending','paid','void')),
  eligible_at timestamptz not null,
  paid_at timestamptz,
  week_of date,
  stripe_transfer_id text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists partner_commissions_due_idx on public.partner_commissions (status, eligible_at);
create index if not exists partner_commissions_partner_idx on public.partner_commissions (partner_id, created_at desc);

alter table public.jobs add column if not exists partner_id uuid references public.referral_partners(id) on delete set null;
create index if not exists jobs_partner_idx on public.jobs (partner_id) where partner_id is not null;

alter table public.referral_partners enable row level security;
alter table public.referral_customers enable row level security;
alter table public.partner_commissions enable row level security;
drop policy if exists staff_all on public.referral_partners;
create policy staff_all on public.referral_partners for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists staff_all on public.referral_customers;
create policy staff_all on public.referral_customers for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists staff_all on public.partner_commissions;
create policy staff_all on public.partner_commissions for all to authenticated using (public.is_staff()) with check (public.is_staff());


-- >>> migration 20261007023000_site_settings_grand_opening.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261007023000_site_settings_grand_opening.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-07_0230 UTC
-- PURPOSE : Small key/value settings staff change from the Hub without a redeploy:
--             site_theme      - the website look shown by default ("classic" | "greengold" | "modern")
--             launch_promo    - the grand opening promotion (start date, days, percent, on/off)
--           Read by the server only; staff edit through the Hub.
--           ALSO fixes the take-rate guard for discounts. Discounts (promo codes, Plus, the grand opening, business pilots)
--           lower price_final while the pro keeps the payout set on the list price, so "payout <= 85% of price_final"
--           rejected discounted bookings (a 20% discount on a typical job broke the insert). The band is now measured on
--           the list price (price_final + discount + member_benefit), which is what the pricing code always intended:
--           discounts come out of our share, never the pro's pay. Old rows aren't re-checked (NOT VALID).
--           Safe to run twice.
-- ============================================================================
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.site_settings enable row level security;
drop policy if exists staff_all on public.site_settings;
create policy staff_all on public.site_settings for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ─── Take-rate guard measured on the list price ──────────────────────────────
alter table public.jobs drop constraint if exists jobs_take_rate_band;
alter table public.jobs add constraint jobs_take_rate_band check (
  contractor_payout is null or price_final is null or price_final = 0 or remedy is not null
  or amount_refunded > 0
  or (contractor_payout <= (price_final + coalesce(discount, 0) + coalesce(member_benefit, 0)) * 0.85
      and contractor_payout >= floor((price_final + coalesce(discount, 0) + coalesce(member_benefit, 0)) * 0.65) - 1)
) not valid;

create or replace function public.guard_payout_amount() returns trigger
language plpgsql security definer set search_path = public as $$
declare j record; parent_take numeric; list numeric;
begin
  if new.job_id is null or new.status = 'clawback' or new.kind <> 'job' then return new; end if;
  select price_final, parent_job_id, remedy, discount, member_benefit into j from public.jobs where id = new.job_id;
  if j.remedy = 'complimentary' and j.parent_job_id is not null then
    select coalesce(price_final, 0) - coalesce(contractor_payout, 0) - coalesce(amount_refunded, 0)
      into parent_take from public.jobs where id = j.parent_job_id;
    if new.amount > greatest(parent_take, 0) then
      raise exception 'Complimentary payout % exceeds our take % on the original job', new.amount, parent_take;
    end if;
  elsif j.price_final is not null then
    list := j.price_final + coalesce(j.discount, 0) + coalesce(j.member_benefit, 0);
    if new.amount > list * 0.85 then
      raise exception 'Payout % exceeds 85%% of the job''s list price % — take would fall below 15%%', new.amount, list;
    end if;
  end if;
  return new;
end $$;


-- >>> migration 20261007030000_bid_measurements.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261007030000_bid_measurements.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-07_0300 UTC
-- PURPOSE : Bid engine measurements: the size of ONE unit of work on a price line (e.g. a 12-acre mowing visit,
--           a 40 cu yd clean-out), so the engine can estimate the pro cost from our pricing engine and the
--           deal-maker can price it. Safe to run twice.
-- ============================================================================
alter table public.bid_cost_lines add column if not exists measure_size numeric check (measure_size is null or measure_size >= 0);
alter table public.bid_cost_lines add column if not exists measure_unit text;


-- >>> migration 20261007040000_loyalty_points.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261007040000_loyalty_points.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-07_0530 UTC
-- PURPOSE : Handled Points — loyalty points for every customer account (rules: packages/core/src/loyalty.ts).
--             • loyalty_settings — earn rate, point value, pending days, expiry, bonuses (one row)
--             • loyalty_ledger   — every point movement for a person (profile_id / email) or a business account:
--                                  earn (per job, pending → available), bonus, redeem (negative), adjust, expire
--             • redeem_loyalty() — turns points into a credit code in one step (no double spending)
--           People read their own points; business members read their account's; writes go through the API.
-- ============================================================================
create table if not exists public.loyalty_settings (
  id int primary key default 1 check (id = 1),
  settings jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.loyalty_settings enable row level security;
drop policy if exists staff_all on public.loyalty_settings;
create policy staff_all on public.loyalty_settings for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  email text,
  business_account_id uuid references public.business_accounts(id) on delete cascade,
  kind text not null check (kind in ('earn','bonus','redeem','adjust','expire')),
  points int not null,
  status text not null default 'available' check (status in ('pending','available','void')),
  job_id uuid references public.jobs(id) on delete set null,
  ref text unique,                -- one per event: earn:<job>, first:<account>, review:<job>
  code text,                      -- credit code a redemption created
  available_at timestamptz,
  detail jsonb,
  note text,
  created_by text not null default 'system',
  created_at timestamptz not null default now(),
  check (profile_id is not null or email is not null or business_account_id is not null)
);
create index if not exists loyalty_ledger_profile_idx on public.loyalty_ledger (profile_id, created_at desc) where business_account_id is null;
create index if not exists loyalty_ledger_email_idx on public.loyalty_ledger (lower(email)) where business_account_id is null;
create index if not exists loyalty_ledger_business_idx on public.loyalty_ledger (business_account_id, created_at desc) where business_account_id is not null;
create index if not exists loyalty_ledger_pending_idx on public.loyalty_ledger (available_at) where status = 'pending';
alter table public.loyalty_ledger enable row level security;
drop policy if exists "read own points" on public.loyalty_ledger;
create policy "read own points" on public.loyalty_ledger for select to authenticated using (
  (business_account_id is null and (profile_id = auth.uid() or lower(email) = lower(auth.jwt() ->> 'email')))
  or (business_account_id is not null and exists (select 1 from public.business_members m where m.account_id = loyalty_ledger.business_account_id and m.profile_id = auth.uid()))
);
drop policy if exists staff_all on public.loyalty_ledger;
create policy staff_all on public.loyalty_ledger for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- credit codes made from points
alter table public.promo_codes drop constraint if exists promo_codes_source_check;
alter table public.promo_codes add constraint promo_codes_source_check check (source in ('staff','gift_card','referral','referral_reward','loyalty'));

-- Points → credit code, atomically: locks the account, checks the available balance, writes both rows.
create or replace function public.redeem_loyalty(p_profile uuid, p_email text, p_business uuid, p_points int, p_code text, p_value numeric, p_who text)
returns text language plpgsql security definer set search_path = public as $$
declare avail int;
begin
  if p_points <= 0 then raise exception 'points must be positive'; end if;
  perform pg_advisory_xact_lock(hashtext('loyalty:' || coalesce(p_business::text, p_profile::text, lower(p_email))));
  select coalesce(sum(points), 0) into avail from public.loyalty_ledger
   where status = 'available'
     and (case when p_business is not null then business_account_id = p_business
               else business_account_id is null and (profile_id = p_profile or lower(email) = lower(p_email)) end);
  if avail < p_points then return null; end if;
  insert into public.promo_codes (code, kind, value, balance, source, owner_profile_id, note, created_by)
  values (p_code, 'gift', p_value, p_value, 'loyalty', p_profile, 'Handled Points credit · ' || p_points || ' points', p_who);
  insert into public.loyalty_ledger (profile_id, email, business_account_id, kind, points, status, code, note, created_by)
  values (p_profile, lower(p_email), p_business, 'redeem', -p_points, 'available', p_code, 'Credit ' || p_code, p_who);
  return p_code;
end $$;
revoke all on function public.redeem_loyalty(uuid, text, uuid, int, text, numeric, text) from public, anon, authenticated;


-- >>> migration 20261007050000_more_service_areas.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261007050000_more_service_areas.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-07_1640 UTC
-- PURPOSE : Service areas beyond Metro Detroit (480–483): the rest of Michigan by region (Handled serves Michigan and Washington).
--           No launch list, so every service can be booked there. A booking still needs a vetted pro who covers the
--           ZIP (no pro → waitlist, nothing charged). Booked ZIPs outside every area join "<State> — new areas"
--           automatically (lib/launch.ts addZipToServiceArea). Safe to run twice.
-- ============================================================================
insert into public.markets (name, state, zip_prefixes)
select v.name, v.state, v.zips from (values
  ('Flint & Tri-Cities', 'MI', array['484','485','486','487']),
  ('Lansing', 'MI', array['488','489']),
  ('Kalamazoo & Battle Creek', 'MI', array['490','491']),
  ('Jackson', 'MI', array['492']),
  ('Grand Rapids & West Michigan', 'MI', array['493','494','495']),
  ('Northern Michigan', 'MI', array['496','497']),
  ('Upper Peninsula', 'MI', array['498','499'])
) as v(name, state, zips)
where not exists (select 1 from public.markets m where m.name = v.name);


-- >>> migration 20261007060000_washington_service_areas.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261007060000_washington_service_areas.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-07_1700 UTC
-- PURPOSE : Washington service areas (Handled serves Michigan and Washington). No launch list → every service bookable.
--             Seattle & Eastside        980, 981   (Seattle, Bellevue, Redmond, Kirkland, Renton, Kent, Auburn, Issaquah)
--             Everett & North Sound     982        (Everett, Lynnwood, Marysville, Mount Vernon, Bellingham)
--             Tacoma & South Sound      983, 984   (Tacoma, Puyallup, Lakewood, Federal Way area, Bremerton / Kitsap)
--             Olympia & Southwest WA    985, 986   (Olympia, Lacey, Tumwater, Centralia, Vancouver WA)
--             Central Washington        988, 989   (Wenatchee, Ellensburg, Yakima)
--             Spokane & Eastern WA      990–994    (Spokane, Spokane Valley, Tri-Cities, Walla Walla, Pullman)
--           A booking still needs a vetted pro who covers the ZIP (no pro → waitlist, nothing charged). Safe to run twice.
-- ============================================================================
insert into public.markets (name, state, zip_prefixes)
select v.name, v.state, v.zips from (values
  ('Seattle & Eastside', 'WA', array['980','981']),
  ('Everett & North Sound', 'WA', array['982']),
  ('Tacoma & South Sound', 'WA', array['983','984']),
  ('Olympia & Southwest WA', 'WA', array['985','986']),
  ('Central Washington', 'WA', array['988','989']),
  ('Spokane & Eastern WA', 'WA', array['990','991','992','993','994'])
) as v(name, state, zips)
where not exists (select 1 from public.markets m where m.name = v.name);


-- >>> migration 20261007070000_washington_area_pricing.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261007070000_washington_area_pricing.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-07_1830 UTC
-- PURPOSE : Area pricing for Washington (markets.price_multiplier, read by lib/launch regionFactor → estimate region):
--             Seattle area (Seattle & Eastside, Everett & North Sound, Tacoma & South Sound)  +25%  → 1.25
--             Rest of Washington (Olympia & Southwest WA, Central Washington, Spokane & Eastern WA, new areas)  +20%  → 1.20
--           Michigan stays 1.00. The pro's pay follows the price. Safe to run twice.
-- ============================================================================
update public.markets set price_multiplier = 1.25
 where state = 'WA' and name in ('Seattle & Eastside', 'Everett & North Sound', 'Tacoma & South Sound');
update public.markets set price_multiplier = 1.20
 where state = 'WA' and name not in ('Seattle & Eastside', 'Everett & North Sound', 'Tacoma & South Sound');


-- >>> migration 20261007080000_job_post_discovery.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261007080000_job_post_discovery.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-07_2030 UTC
-- PURPOSE : Automatic job-posting leads: businesses in Michigan and Washington hiring for work we do (cleaner, janitor,
--           porter, maintenance…) found daily through a licensed job-search API (Adzuna), then emailed the
--           "book it as a service instead of hiring" sequence.
--             • biz_leads.source adds 'job_board'; new columns state, posting_pay, posted_at
--             • biz_lead_settings.job_posts_per_day — searches per weekday (0 = off)
--           Safe to run twice.
-- ============================================================================
alter table public.biz_leads drop constraint if exists biz_leads_source_check;
alter table public.biz_leads add constraint biz_leads_source_check check (source in ('google_places','csv','manual','job_board'));
alter table public.biz_leads
  add column if not exists state text,
  add column if not exists posting_pay text check (posting_pay is null or length(posting_pay) <= 40),
  add column if not exists posted_at timestamptz;
create index if not exists biz_leads_company_idx on public.biz_leads (lower(business_name));
alter table public.biz_lead_settings add column if not exists job_posts_per_day int not null default 6 check (job_posts_per_day between 0 and 40);


-- >>> migration 20261009030000_handled_uplift.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261009030000_handled_uplift.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-09_0300 UTC
-- PURPOSE : Handled keeps 5 more points of every price, paid by customers (pro pay in dollars is unchanged).
--           Handled's share can now reach 40% (was 35%), so the guards move: a pro's payout may be as low as 60% of
--           the list price (was 65%); the services catalog's reporting share band becomes 0.60-0.85.
-- ============================================================================
alter table public.jobs drop constraint if exists jobs_take_rate_band;
alter table public.jobs add constraint jobs_take_rate_band check (
  contractor_payout is null or price_final is null or price_final = 0 or remedy is not null
  or amount_refunded > 0
  or (contractor_payout <= (price_final + coalesce(discount, 0) + coalesce(member_benefit, 0)) * 0.85
      and contractor_payout >= floor((price_final + coalesce(discount, 0) + coalesce(member_benefit, 0)) * 0.60) - 1)
) not valid;

alter table public.services drop constraint if exists services_payout_share_band;
alter table public.services add constraint services_payout_share_band check (payout_share between 0.60 and 0.85);


-- >>> migration 20261011140500_freight_cargo_coverage.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261011140500_freight_cargo_coverage.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-11_1405 UTC
-- PURPOSE : Freight & Pallet Delivery (licensed carriers). Carriers upload motor truck cargo insurance, stored as
--           coverage kind 'cargo'. The service itself comes from the catalog sync.
-- ============================================================================
alter table public.contractor_documents drop constraint if exists contractor_documents_kind_check;
alter table public.contractor_documents add constraint contractor_documents_kind_check
  check (kind in ('w9','coi','license','background','agreement','auto','workers_comp','bond','liquor','passenger_auto','cargo','certification','skills','other'));


-- >>> migration 20261011224200_notification_log.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261011224200_notification_log.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-11_2242 UTC
-- PURPOSE : Notification log — every email, text and push the system sends (lib/notification-log): channel, recipient,
--           subject, a short preview (links and sign-in codes removed), sent / failed / skipped and why, and the job it's
--           about. Shown on the Hub job page and as "last contacted" on Hub → Dispatch. Kept 180 days.
-- ============================================================================
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

-- staff only (customers and pros never read it); the server writes with the service role
alter table public.notification_log enable row level security;
drop policy if exists staff_read on public.notification_log;
create policy staff_read on public.notification_log for select to authenticated using (public.is_staff());


-- >>> migration 20261011225000_saved_checklists.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261011225000_saved_checklists.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-11_2250 UTC
-- PURPOSE : Saved checklists — staff-made or edited checklists stored in the job checklist format (Hub → Checklists):
--           pick one, attach it to a job (jobs.checklist) or email it to a pro. Built-in service templates stay in code.
-- ============================================================================
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


-- >>> migration 20261012000500_dispatch_gaps.sql
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


-- >>> migration 20261012012100_id_numbers.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261012012100_id_numbers.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-12_0121 UTC
-- PURPOSE : ID numbers for everyone, alongside job refs (H-1001…):
--             customers  C-10001…  customer_ids, one per email — guests get one on their first booking, accounts
--                                  on sign-up; the account (profile) is linked when it exists
--             clients    B-501…    business_accounts.client_no
--             pros       P-1001…   contractors.pro_no
--             staff      S-101…    profiles.staff_no, given when someone becomes admin or dispatcher (kept after)
--           Existing records are numbered oldest first. Safe to run twice.
-- ============================================================================

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


-- >>> migration 20261012152500_talent_flat_fee.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261012152500_talent_flat_fee.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-12_1525 UTC
-- PURPOSE : Handled Talent — flat fee per hire: a third search type ("flat") with its fee per hire (flat_fee).
--           Flat searches keep fee_pct and recruiter_pct at 0; the recruiter gets 80% of the flat fee. Safe to run twice.
-- ============================================================================
alter table public.talent_searches add column if not exists flat_fee numeric;
alter table public.talent_searches drop constraint if exists talent_searches_type_check;
alter table public.talent_searches add constraint talent_searches_type_check check (type in ('contingency','retained','flat'));
alter table public.talent_searches drop constraint if exists talent_searches_fee_pct_check;
alter table public.talent_searches add constraint talent_searches_fee_pct_check check (fee_pct >= 0 and fee_pct <= 50 and (type = 'flat' or fee_pct > 0));
alter table public.talent_searches drop constraint if exists talent_searches_flat_fee_check;
alter table public.talent_searches add constraint talent_searches_flat_fee_check check (type <> 'flat' or coalesce(flat_fee, 0) > 0);


-- >>> migration 20261015030000_book_now_pay_after.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261015030000_book_now_pay_after.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-15_0300 UTC
-- PURPOSE : Book now, pay the rest when it's done (packages/core/src/pricing.ts → BOOK_NOW, PAY_IN_FULL).
--             • jobs.payment_plan adds 'after': 25% at booking (deposit_amount / deposit_paid_at); the balance is held
--               on the card when the pro starts (balance_hold_intent, a Stripe authorization) and charged when the job
--               is complete; a failed charge is retried daily (balance_charge_at = next try, balance_attempts)
--             • pay_in_full_discount: the 5% saving for paying in full at booking (taken from our share)
--           Safe to run twice.
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


-- >>> migration 20261018024800_pro_resume_photo.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261018024800_pro_resume_photo.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-18_0248 UTC
-- PURPOSE : Pro onboarding: resume and profile photo uploads.
--             • contractors.resume_uploaded_at / photo_uploaded_at — the setup steps (files are
--               contractor_documents rows, kinds 'resume' and 'photo', in the private pro-docs bucket)
--             • contractors.upload_reminders / last_upload_reminder_at — "missing uploads" reminders for
--               pros who are already live (pros still in setup get them in the normal setup reminders)
-- UPDATED : 2026-10-18_0415 UTC — pros that are businesses: LLCs taxed as S/C corporations on the W-9 (no 1099-NEC);
--           contractors.agreement_signed_for / agreement_signer_title and contract_acceptances.on_behalf_of /
--           signer_title (signing the pro agreement for a business).
--           Safe to run twice.
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


-- >>> migration 20261019201500_gov_awards.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261019201500_gov_awards.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-19_2015 UTC
-- PURPOSE : Federal contract AWARDS from SAM.gov's Contract Awards API (packages/core/src/gov-awards.ts,
--           Hub → Gov contracts → Awards & recompetes).
--             • gov_awards      — one row per contract (base award + modifications merged): who holds it, value,
--                                 end date, place of work, recompete fit score, our watch status and notes
--             • gov_settings    — awards_enabled / awards_months_back / awards_pages for the weekly awards run
--             • gov_api_calls   — 'awards' added as a call kind (same key and daily budget as opportunities)
--           Staff only. The SAM.gov API key stays in Vercel (SAM_API_KEY).
-- ============================================================================
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
create policy staff_all on public.gov_awards for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.gov_settings add column if not exists awards_enabled boolean not null default false;
alter table public.gov_settings add column if not exists awards_months_back int not null default 24 check (awards_months_back between 1 and 60);
alter table public.gov_settings add column if not exists awards_pages int not null default 2 check (awards_pages between 1 and 20);

alter table public.gov_api_calls drop constraint if exists gov_api_calls_kind_check;
alter table public.gov_api_calls add constraint gov_api_calls_kind_check check (kind in ('search','description','awards'));


-- >>> migration 20261019214000_gov_subcontracting.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261019214000_gov_subcontracting.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-19_2140 UTC
-- PURPOSE : Subcontracting under federal primes (Hub → Gov contracts → Awards & recompetes → Subcontract targets).
--             • gov_awards    — the prime's size (contracting officer's call: S small / O other than small), its
--                               small-business subcontracting plan, phone and address; the subcontract fit score
--             • gov_settings  — awards_naics: the codes the awards search uses (default: our focus — landscaping
--                               561730, painting 238320, AI automation 541511 / 541512 / 541519, window installation
--                               238150, carpet cleaning 561740, construction 236220 / 236118); the opportunities
--                               search moves to the same focus if it was still on the original defaults
-- ============================================================================
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


-- >>> migration 20261019223000_biz_leads_instantly.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261019223000_biz_leads_instantly.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-19_2230 UTC
-- PURPOSE : Business leads that come from an Instantly campaign run in Instantly (e.g. 1ST OUTREACH DETROIT):
--           source 'instantly' (external_id = the email) so syncBizCampaign and the webhook can add them to the CRM.
-- ============================================================================
alter table public.biz_leads drop constraint if exists biz_leads_source_check;
alter table public.biz_leads add constraint biz_leads_source_check check (source in ('google_places','csv','manual','job_board','instantly'));


-- >>> migration 20261019233000_gov_daily_picks.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261019233000_gov_daily_picks.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-19_2330 UTC
-- PURPOSE : The AI bid desk's daily picks (lib/gov.ts govDailyPicks) and the Deal hunter (lib/ai/deal-hunter.ts).
--             • gov_settings.daily_picks     — notices to pick each weekday to propose on (default 5)
--             • gov_opportunities.picked_at  — when the bid desk picked it (one pick per notice)
--             • daily SAM.gov call budget 8 → 10 (a personal key's limit) where it was still the default: the
--               state-wide search uses ~4 calls, the 5 bid briefs ~5
-- ============================================================================
alter table public.gov_settings add column if not exists daily_picks int not null default 5 check (daily_picks between 0 and 20);
alter table public.gov_opportunities add column if not exists picked_at timestamptz;
create index if not exists gov_opportunities_picked on public.gov_opportunities (picked_at);
update public.gov_settings set daily_call_budget = 10 where daily_call_budget = 8;


-- >>> migration 20261020001500_call_desk.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261020001500_call_desk.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-20_0015 UTC
-- PURPOSE : The Call desk (Hub → Business leads → Call desk; packages/core/src/call-desk.ts):
--             • biz_leads.next_call_at / call_attempts / last_call_outcome / last_called_at — the call queue and follow-ups
--             • biz_lead_settings.call_goal — dials a day (default 30)
--           Each call is also an event on the lead's history (kind 'call:<outcome>').
-- ============================================================================
alter table public.biz_leads add column if not exists next_call_at timestamptz;
alter table public.biz_leads add column if not exists call_attempts int not null default 0;
alter table public.biz_leads add column if not exists last_call_outcome text;
alter table public.biz_leads add column if not exists last_called_at timestamptz;
create index if not exists biz_leads_next_call on public.biz_leads (next_call_at);
alter table public.biz_lead_settings add column if not exists call_goal int not null default 30 check (call_goal between 0 and 500);


-- >>> migration 20261020010000_omnichannel.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261020010000_omnichannel.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-20_0100 UTC
-- PURPOSE : Omnichannel outreach (packages/core/src/channels.ts):
--             1. Lead inbox — every inbound lead (website form, AI chat, Meta Lead Ads, Google Ads lead forms, and
--                TikTok / LinkedIn / Yelp / Google Local Services through Zapier or Make) with its channel, campaign,
--                SMS consent, and how fast we answered (speed to lead). Business leads also go to the Call desk.
--             2. Conversion tracking needs no tables (pixels + server events; Google offline conversions export).
--             3. Social — the AI's weekly Facebook / Instagram / TikTok calendar: drafts, approval, publishing.
-- ============================================================================
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
create policy staff_all on public.social_posts for all to authenticated using (public.is_staff()) with check (public.is_staff());


-- >>> migration 20261020020000_pro_marketplace.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261020020000_pro_marketplace.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-20_0200 UTC
-- PURPOSE : The dynamic marketplace (packages/core/src/pro-rates.ts), still upfront pricing:
--             • pro_rates       — each pro's price per service: 80–175% of Handled's suggested pay, optional minimum job
--             • jobs            — priced_by (engine / offer / pro_rate / quote) and the pro's % when they set the price
--             • quote_requests  — a customer's big job (remodel, construction, cleanout, commercial…) sent to up to 3
--                                 nearby pros; the customer's private link shows the quotes
--             • quote_bids      — each pro's firm quote (their pay → the customer's all-in price), earliest date, note
-- ============================================================================
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
create policy staff_all on public.quote_bids for all to authenticated using (public.is_staff()) with check (public.is_staff());


-- >>> migration 20261022040000_referral_tickets.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261022040000_referral_tickets.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-22_0400 UTC
-- UPDATED : 2026-10-22_0500 UTC - photos on the ticket (same private bucket and paths as booking photos).
-- UPDATED : 2026-10-22_0600 UTC - the Standard Referral Ticket (RT-1): details (relationship, contact preference, property,
--           occupancy, pets, parking, preferred date, decision maker), standard_version and a 0-100 completeness score.
-- PURPOSE : Referral program, part 2: REFERRAL TICKETS. Pros, clients and anyone in the partner program fill out a
--           ticket for one job (customer, address, what's needed, how often, when). AI files it: the right service,
--           frequency and pricing answers, a summary and what's missing, linked to the referrer and the customer.
--           The customer gets a pre-filled booking link; once they pay, the job is broadcast to pros and assigned
--           like any other, and the money splits: pro payout, referrer commission, Handled's share.
--           Rates (packages/core/src/partners.ts), always a share of Handled's take (since 2026-10-22_0900 the cost is
--           shared half Handled / half the pro on the job - see 20261022090000_shared_referral_bonus.sql):
--             refer a person          - 10% on every job from that customer for 12 months (existing)
--             ticket, one-time job    - 20% on that job
--             ticket, recurring job   - 15% on every visit of that plan for 12 months
--             referral_tickets               - the ticket: open / needs_review -> booked -> (expired / cancelled)
--             jobs.referral_ticket_id        - the ticket a job (and every later visit of its plan) is credited to
--             partner_commissions.basis/pct  - which rule paid the commission, and at what rate
--             referral_partners.contractor_id - the pro behind a partner account (pros and clients join in one tap)
--           Staff read/write through the Hub; partners see their own tickets through the server. Safe to run twice.
-- ============================================================================
create table if not exists public.referral_tickets (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,                -- the customer's booking link (/book?ticket=…)
  partner_id uuid not null references public.referral_partners(id) on delete cascade,
  -- the customer
  customer_email text not null,              -- lower-case
  customer_name text not null,
  customer_phone text,
  customer_id uuid references public.profiles(id) on delete set null,   -- their Handled account, when they have one
  company_name text,
  address text, city text, state text, zip text,
  -- the job, as the referrer described it
  description text not null,
  service_slug text,                         -- what the referrer picked, then what the AI / staff settled on
  frequency text not null default 'once' check (frequency in ('once','weekly','biweekly','monthly','quarterly')),
  urgency text check (urgency in ('asap','this_week','two_weeks','month','flexible')),
  budget numeric(12,2),
  access_notes text,
  photos text[] not null default '{}',       -- job-photos bucket paths (booking/… or pro/…), max 8
  customer_consent boolean not null default false,  -- "the customer asked me to send this"
  preferred_contractor_id uuid references public.contractors(id) on delete set null,  -- a referring pro who wants first look
  -- what the AI made of it
  answers jsonb not null default '{}'::jsonb,
  ai_summary text,
  missing_info text[] not null default '{}',
  ai_confidence text check (ai_confidence in ('high','medium','low')),
  -- where it is
  status text not null default 'open' check (status in ('open','needs_review','booked','expired','cancelled')),
  basis text check (basis in ('job_once','job_recurring')),   -- set at booking from what the customer booked
  job_id uuid references public.jobs(id) on delete set null,  -- the first booked job
  pays_until timestamptz,                    -- recurring: 12 months from booking
  expires_at timestamptz not null,           -- the customer has until then to book
  events jsonb not null default '[]'::jsonb, -- the ticket's timeline [{at, text}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.referral_tickets add column if not exists photos text[] not null default '{}';  -- for databases that ran the first version
alter table public.referral_tickets add column if not exists details jsonb not null default '{}'::jsonb;  -- Standard Referral Ticket fields
alter table public.referral_tickets add column if not exists standard_version text;
alter table public.referral_tickets add column if not exists completeness int check (completeness between 0 and 100);
create index if not exists referral_tickets_match_idx on public.referral_tickets (customer_email, service_slug) where status in ('open','needs_review');
create index if not exists referral_tickets_partner_idx on public.referral_tickets (partner_id, created_at desc);
create index if not exists referral_tickets_status_idx on public.referral_tickets (status, created_at desc);

alter table public.jobs add column if not exists referral_ticket_id uuid references public.referral_tickets(id) on delete set null;
create index if not exists jobs_referral_ticket_idx on public.jobs (referral_ticket_id) where referral_ticket_id is not null;

alter table public.partner_commissions add column if not exists basis text not null default 'person';
alter table public.partner_commissions drop constraint if exists partner_commissions_basis_check;
alter table public.partner_commissions add constraint partner_commissions_basis_check check (basis in ('person','job_once','job_recurring'));
alter table public.partner_commissions add column if not exists pct numeric(5,4) check (pct is null or (pct > 0 and pct <= 0.5));

alter table public.referral_partners add column if not exists contractor_id uuid references public.contractors(id) on delete set null;

alter table public.referral_tickets enable row level security;
drop policy if exists staff_all on public.referral_tickets;
create policy staff_all on public.referral_tickets for all to authenticated using (public.is_staff()) with check (public.is_staff());


-- >>> migration 20261022070000_ticket_invites.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261022070000_ticket_invites.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-22_0700 UTC
-- UPDATED : 2026-10-22_0800 UTC - pros and partners send invites too (invited_by_partner_id: who brought them into the network).
-- PURPOSE : Referral TICKET INVITES. Someone we speak with on the phone (a call desk lead, a customer, a contractor)
--           gets a personal link by text and/or email. It opens the Standard Referral Ticket with their own details
--           already filled in; submitting it sends us the job AND signs them up as a referral partner (their Handled
--           account is created from the welcome email), so they join the network. They can also just join with no job
--           yet, and apply as a pro from the same link. Rules: apps/web/lib/ticket-invites.ts.
--             ticket_invites - who we invited, how (email / text, with their consent on the call), and what came of it:
--                              sent -> opened -> completed (joined; ticket_id when they sent a job) / expired
--           Staff read/write through the Hub; the invitee only through their link (server). Safe to run twice.
-- ============================================================================
create table if not exists public.ticket_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,                 -- the personal link (/ticket/…)
  name text not null,
  email text,                                 -- lower-case
  phone text,
  company text,
  kind text not null default 'other',         -- what they are (referral_partners.kind values)
  job_hint text,                              -- what they mentioned on the call (starts the ticket's description)
  sent_by text not null,                      -- staff email or "<agent> (IEBC)"
  via_email boolean not null default false,
  via_sms boolean not null default false,
  sms_consent boolean not null default false, -- they agreed on the call to get this by text
  status text not null default 'sent' check (status in ('sent','opened','completed','expired','cancelled')),
  opened_at timestamptz,
  completed_at timestamptz,
  partner_id uuid references public.referral_partners(id) on delete set null,
  ticket_id uuid references public.referral_tickets(id) on delete set null,
  biz_lead_id uuid,                           -- the Call desk lead it was sent from, if any
  invited_by_partner_id uuid references public.referral_partners(id) on delete set null,  -- a pro or partner sent it (null = Handled staff / IEBC)
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.ticket_invites add column if not exists invited_by_partner_id uuid references public.referral_partners(id) on delete set null;  -- for databases that ran the first version
create index if not exists ticket_invites_by_partner_idx on public.ticket_invites (invited_by_partner_id, created_at desc) where invited_by_partner_id is not null;
create index if not exists ticket_invites_status_idx on public.ticket_invites (status, created_at desc);
create index if not exists ticket_invites_email_idx on public.ticket_invites (email);

alter table public.ticket_invites enable row level security;
drop policy if exists staff_all on public.ticket_invites;
create policy staff_all on public.ticket_invites for all to authenticated using (public.is_staff()) with check (public.is_staff());


-- >>> migration 20261022090000_shared_referral_bonus.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261022090000_shared_referral_bonus.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-22_0900 UTC
-- PURPOSE : The referral bonus is SHARED: half from Handled's take, half from the pro who does the job
--           (packages/core/src/partners.ts REFERRAL_COST_SPLIT). The bonus itself is unchanged (10% / 15% / 20% of
--           Handled's take, worked out on the pro's full pay). The pro's half is a separate line on their payout
--           statement ("Your half of the referral bonus - JOB-REF"), netted in the weekly payout, and it follows refunds
--           down. It applies to jobs accepted from 2026-11-22 (30 days' notice) under contractor agreement v10+;
--           before that, or with no pro on the job, Handled carries the whole bonus.
--             jobs.referral_pct                       - the referral rate on a credited job (shown on the offer / work order)
--             partner_commissions.pro_share / handled_share / contractor_id / pro_share_payout_id
--             payouts.kind 'referral_share'           - the pro's half (negative, netted like a clawback)
--           Safe to run twice.
-- ============================================================================
alter table public.jobs add column if not exists referral_pct numeric(5,4) check (referral_pct is null or (referral_pct > 0 and referral_pct <= 0.5));

alter table public.partner_commissions add column if not exists pro_share numeric(12,2) not null default 0 check (pro_share >= 0);
alter table public.partner_commissions add column if not exists handled_share numeric(12,2);
alter table public.partner_commissions add column if not exists contractor_id uuid references public.contractors(id) on delete set null;
alter table public.partner_commissions add column if not exists pro_share_payout_id uuid references public.payouts(id) on delete set null;
alter table public.partner_commissions drop constraint if exists partner_commissions_shares_check;
alter table public.partner_commissions add constraint partner_commissions_shares_check check (pro_share <= amount) not valid;

-- the pro's half rides the payout run like a clawback (status 'clawback', negative amount)
alter table public.payouts drop constraint if exists payouts_kind_check;
alter table public.payouts add constraint payouts_kind_check
  check (kind in ('job','show_up','guarantee','stipend','materials','clawback','referral','tip','placement','referral_share'));


-- >>> migration 20261022100000_one_handled_account.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261022100000_one_handled_account.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-22_1000 UTC
-- PURPOSE : ONE HANDLED ACCOUNT for everything (book, refer, get paid, work as a pro). Everyone who joins the referral
--           network gets a Handled account at sign-up (apps/web/lib/partners.ts ensureAccount), and a referral partner
--           is paid only through a linked account. This keeps the database side in step:
--             - handle_new_user(): a new account also links a referral partner record with the same email (as it
--               already does for guest bookings and pro records)
--             - backfill: existing partners linked to existing accounts by email
--           Same function body as 20261001172300_init.sql plus one line. Safe to run twice.
-- ============================================================================
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
  -- link a referral partner record with this email (one Handled account: book, refer, get paid)
  update public.referral_partners set profile_id = new.id where profile_id is null and lower(email) = lower(new.email);
  return new;
end $$;

-- partners who joined before their account existed (or before this ran): link them now
update public.referral_partners rp set profile_id = p.id
  from public.profiles p
 where rp.profile_id is null and p.email is not null and lower(p.email) = lower(rp.email);


-- >>> seed.sql
-- ============================================================================
-- FILE    : supabase/seed.sql   (generated by scripts/gen-seed.ts — do not hand edit)
-- PROJECT : Handled — AI-run home & business services
-- CREATED : 2026-10-22_0520 UTC
-- PURPOSE : PRODUCTION seed — service catalog + launch market. Safe to re-run.
-- ============================================================================

insert into public.services (slug, name, category, minimum, payout_share, site_visit, sort) values
  ('house-cleaning', 'House & Office Cleaning', 'cleaning', 120, 0.738, false, 0),
  ('window-cleaning', 'Window Cleaning', 'cleaning', 149, 0.714, false, 1),
  ('carpet-cleaning', 'Carpet & Upholstery Cleaning', 'cleaning', 129, 0.745, false, 2),
  ('organizing', 'Organizing & Decluttering', 'cleaning', 199, 0.716, false, 3),
  ('gutter-cleaning', 'Gutter Cleaning', 'cleaning', 149, 0.741, false, 4),
  ('power-washing', 'Power Washing', 'cleaning', 149, 0.739, false, 5),
  ('mobile-car-detailing', 'Mobile Car Detailing', 'cleaning', 79, 0.738, false, 6),
  ('lawn-care', 'Lawn Care', 'outdoor', 55, 0.75, false, 7),
  ('tree-removal', 'Tree Removal & Trimming', 'outdoor', 250, 0.626, true, 8),
  ('leaf-removal', 'Leaf Removal', 'outdoor', 125, 0.715, false, 9),
  ('snow-removal', 'Snow Removal', 'outdoor', 40, 0.743, false, 10),
  ('dog-walking', 'Dog Walking', 'pets', 22, 0.75, false, 11),
  ('dog-sitting', 'Dog Sitting & Pet Watching', 'pets', 28, 0.745, false, 12),
  ('pet-waste-removal', 'Dog Poop Removal', 'pets', 20, 0.677, false, 13),
  ('junk-removal', 'Junk Removal', 'removal', 129, 0.722, false, 14),
  ('large-item-removal', 'Large Item Removal', 'removal', 99, 0.755, false, 15),
  ('junk-container', 'Junk Container (Drop-off & Pickup)', 'removal', 349, 0.677, false, 16),
  ('dead-animal-removal', 'Dead Animal Removal', 'removal', 129, 0.747, false, 17),
  ('waste-oil-collection', 'Used Oil Collection', 'removal', 95, 0.755, false, 18),
  ('small-moves', 'Small Moves & Moving Help', 'removal', 199, 0.624, false, 19),
  ('retail-delivery', 'Same-Day Large Item Delivery', 'removal', 89, 0.747, false, 20),
  ('staging-transport', 'Home Staging Furniture Moves', 'removal', 249, 0.627, false, 21),
  ('unit-turnover', 'Rental Unit Turnover', 'repair_remodel', 299, 0.65, false, 22),
  ('handyman', 'Handyman', 'repair_remodel', 99, 0.739, false, 23),
  ('plumbing', 'Plumbing Repairs', 'repair_remodel', 149, 0.737, false, 24),
  ('water-heater', 'Water Heater Replace & Repair', 'repair_remodel', 175, 0.797, false, 25),
  ('hvac-install', 'HVAC Installation', 'repair_remodel', 3500, 0.63, true, 26),
  ('lighting-install', 'Lighting & Ceiling Fan Install', 'repair_remodel', 149, 0.73, false, 27),
  ('camera-install', 'Security Camera Install', 'repair_remodel', 149, 0.699, false, 28),
  ('garbage-disposal', 'Garbage Disposal Repair & Replace', 'repair_remodel', 149, 0.697, false, 29),
  ('small-engine-repair', 'Small Engine Repair', 'repair_remodel', 69, 0.753, false, 30),
  ('dock-door-service', 'Loading Dock & Overhead Door Service', 'repair_remodel', 195, 0.718, false, 31),
  ('fire-extinguisher-inspection', 'Fire Extinguisher Inspection & Service', 'repair_remodel', 79, 0.75, false, 32),
  ('interior-painting', 'Interior Painting', 'repair_remodel', 349, 0.625, false, 33),
  ('exterior-painting', 'Exterior Painting', 'repair_remodel', 1200, 0.629, false, 34),
  ('roofing', 'Roofing', 'repair_remodel', 350, 0.699, true, 35),
  ('flooring', 'Flooring Installation', 'repair_remodel', 450, 0.67, false, 36),
  ('paving', 'Paving & Driveways', 'outdoor', 300, 0.714, false, 37),
  ('tree-trimming', 'Tree Trimming & Pruning', 'outdoor', 225, 0.677, false, 38),
  ('foundation-repair', 'Foundation Repair', 'repair_remodel', 550, 0.628, true, 39),
  ('mold-removal', 'Mold Removal', 'repair_remodel', 450, 0.627, false, 40),
  ('bathroom-remodel', 'Bathroom Remodel', 'repair_remodel', 3500, 0.63, true, 41),
  ('kitchen-remodel', 'Kitchen Remodel', 'repair_remodel', 12000, 0.63, true, 42),
  ('home-remodel', 'Whole-Home Remodel', 'repair_remodel', 25000, 0.63, true, 43),
  ('errands', 'Errands & Pickups', 'errands', 39, 0.738, false, 44),
  ('courier', 'Same-Day Courier', 'errands', 25, 0.69, false, 45),
  ('medical-delivery', 'Medical Deliveries', 'errands', 29, 0.686, false, 46),
  ('personal-assistant', 'Personal Assistant for the Day', 'errands', 120, 0.74, false, 47),
  ('private-driver', 'Private Driver / Black Car', 'transport', 170, 0.726, false, 48),
  ('urgent-ride', 'Urgent Ride (Non-Medical)', 'transport', 45, 0.746, false, 49),
  ('airport-transfer', 'Airport Transfer', 'transport', 95, 0.755, false, 50),
  ('limousine', 'Limousine', 'transport', 405, 0.643, false, 51),
  ('party-bus', 'Party Bus', 'transport', 900, 0.627, false, 52),
  ('charter-bus', 'Tour & Charter Bus', 'transport', 1100, 0.628, false, 53),
  ('game-day-rides', 'Game Day & Concert Rides', 'transport', 440, 0.626, false, 54),
  ('event-shuttle', 'Corporate & Event Shuttle', 'transport', 450, 0.624, false, 55),
  ('event-package', 'Plan My Event (by Budget)', 'events', 1000, 0.629, true, 56),
  ('event-planning', 'Event Planning & Coordination', 'events', 650, 0.628, true, 57),
  ('catering', 'Catering', 'events', 600, 0.628, false, 58),
  ('food-truck', 'Food Truck Booking', 'events', 1200, 0.628, false, 59),
  ('dj-music', 'DJ & Live Music', 'events', 450, 0.625, false, 60),
  ('event-security', 'Event Security', 'events', 220, 0.688, false, 61),
  ('security-guard', 'Security Guards & Patrol', 'security', 160, 0.715, false, 62),
  ('event-rentals', 'Seating & Party Rentals', 'events', 250, 0.66, false, 63),
  ('event-venue', 'Event Space Rental & Coordination', 'events', 800, 0.628, true, 64),
  ('freight-delivery', 'Freight & Pallet Delivery', 'removal', 125, 0.708, false, 65),
  ('website-design', 'Intelligent Websites', 'business', 1500, 0.629, true, 66),
  ('business-operating-system', 'Business Operating System', 'business', 7500, 0.63, true, 67),
  ('automated-business', 'Automated Business', 'business', 12000, 0.63, true, 68),
  ('business-formation', 'Business Formation (LLC & Corporation)', 'business', 299, 0.713, true, 69),
  ('business-consulting', 'Business Consulting', 'business', 300, 0.699, true, 70),
  ('ai-automation', 'AI Automation', 'business', 675, 0.626, true, 71),
  ('ai-agents', 'Custom AI Agents', 'business', 2500, 0.629, true, 72)
on conflict (slug) do update set name = excluded.name, category = excluded.category, minimum = excluded.minimum,
  payout_share = excluded.payout_share, site_visit = excluded.site_visit, sort = excluded.sort;

insert into public.markets (name, state, zip_prefixes)
select 'Metro Detroit', 'MI', array['480','481','482','483'] where not exists (select 1 from public.markets where name = 'Metro Detroit');

