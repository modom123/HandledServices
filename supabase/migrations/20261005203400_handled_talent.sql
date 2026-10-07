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
