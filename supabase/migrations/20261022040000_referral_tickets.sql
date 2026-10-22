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
