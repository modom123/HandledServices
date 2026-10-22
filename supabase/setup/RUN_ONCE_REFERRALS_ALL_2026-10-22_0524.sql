-- ============================================================================
-- FILE    : supabase/setup/RUN_ONCE_REFERRALS_ALL_2026-10-22_0524.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-22_0524 UTC
-- PURPOSE : ONE PASTE for every referral-program database change from 2026-10-22, in order:
--             1. referral tickets (Standard Referral Ticket RT-1, photos, completeness)   - 20261022040000
--             2. ticket invites (send a ticket after a phone call; pros & partners too)  - 20261022070000
--             3. shared referral bonus (half Handled / half the pro on the job)          - 20261022090000
--           Supabase -> SQL Editor -> New query -> paste this whole file -> Run.
--           Safe to run more than once (every statement is "if not exists" / drop-and-recreate).
--           Needs the earlier Referral Partner Program tables (ADD_REFERRAL_PARTNERS_2026-10-07_0100.sql), which
--           are already in place if Hub -> Partners works today.
-- ============================================================================

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

-- done: Hub -> Setup should now show referral tickets, ticket invites and the shared referral bonus as ready.
