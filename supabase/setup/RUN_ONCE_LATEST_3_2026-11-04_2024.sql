-- ============================================================================
-- FILE    : supabase/setup/RUN_ONCE_LATEST_3_2026-11-04_2024.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-11-04_2024 UTC
-- PURPOSE : ONE paste for the 3 newest database migrations, in order:
--             1. 20261028012200_partner_tickets_tiers  referral partner rates (one-time / repeat / account) and tickets
--             2. 20261028173500_hub_customer_totals    Mastermind customer list covers every customer
--             3. 20261028224500_pro_orientation        pro "Welcome to Handled" orientation progress
--           Safe to run twice: every statement skips or replaces what already exists.
--           Supabase -> SQL Editor -> New query -> paste this whole file -> Run.
-- ============================================================================


-- >>> migration 20261028012200_partner_tickets_tiers.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261028012200_partner_tickets_tiers.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-28_0122 UTC
-- PURPOSE : Referral Partner Program v2 (rules: packages/core/src/partners.ts).
--             • Fixed earnings tiers of the job price: 25% one-time first job / 10% repeat or recurring (12 months) /
--               15% business or property account (12 months), paid half by the pro and half by Handled.
--             • The standard referral ticket: every referral a partner sends has the same fields, a ticket number
--               (RT-XXXXXX) and a status (submitted -> we reached out -> booked -> job done -> paid, or closed).
--             referral_customers   + ticket fields, status, staff note
--             partner_commissions  + tier, rate, from_pro, from_us, pro_returned (pro's half handed back after a refund)
--             jobs                 + partner_tier, partner_pro_fee (the pro's half, taken off their job payout)
--             payouts.kind         + 'partner_fee' (a pro's half handed back when a refund cuts the commission)
--           Safe to run twice.
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


-- >>> migration 20261028173500_hub_customer_totals.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261028173500_hub_customer_totals.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-28_1735 UTC
-- PURPOSE : Mastermind -> Clients -> Customers & B2B: one row per customer (by email) totalled in the database, so the
--           list covers every customer instead of only the newest jobs the page could read.
--             email, name, phone, type (from their latest job), jobs, spend (completed jobs), recurring, last
--           security_invoker: the view runs with the reader's rights (staff only, through the jobs table's RLS).
--           Safe to run twice.
-- ============================================================================
create or replace view public.hub_customer_totals with (security_invoker = true) as
select
  lower(contact_email) as email,
  (array_agg(coalesce(nullif(company_name, ''), contact_name) order by created_at desc))[1] as name,
  (array_agg(contact_phone order by created_at desc))[1] as phone,
  (array_agg(customer_type order by created_at desc))[1] as type,
  count(*)::int as jobs,
  coalesce(sum(price_final) filter (where status = 'completed'), 0)::numeric(12,2) as spend,
  bool_or(frequency <> 'once') as recurring,
  max(created_at) as last
from public.jobs
where contact_email is not null
group by lower(contact_email);

grant select on public.hub_customer_totals to authenticated;


-- >>> migration 20261028224500_pro_orientation.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261028224500_pro_orientation.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-10-28_2245 UTC
-- PURPOSE : New pros' portal:
--             • "Welcome to Handled" orientation progress per pro (lesson id → time finished). Finishing every lesson
--               is a required onboarding step before Handled approves a pro (packages/core/src/orientation.ts).
--             • Photos of the job on referral tickets (pros and partners "snap it, ticket it, get paid").
-- ============================================================================
alter table public.contractors add column if not exists orientation jsonb not null default '{}'::jsonb;
alter table public.referral_customers add column if not exists photos text[] not null default '{}';

