-- ============================================================================
-- FILE    : supabase/migrations/20261106163800_field_sales.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-11-06_1638 UTC
-- UPDATED : 2026-11-06_1730 UTC - fits partner-v2 (20261028012200_partner_tickets_tiers.sql must run first).
-- PURPOSE : Direct sales / Field Sales (Partner Program, partner-v3). Two ways to earn:
--             referrals   - partner-v2 tiers (25% / 10% / 15% of the job price, half from the pro), unchanged
--             direct sales - the partner closes the sale on a close-ready SALES TICKET (photos, service + sizes, customer,
--                            address, timing, decision maker, price shown); the customer pays Handled (on the partner's
--                            phone or from our text); the paid job goes to the job board. Paid on the ladder: 10% -> 45%
--                            of Handled's take (rules: packages/core/src/partners.ts, PARTNER_LADDER), by Handled alone.
--             sales_tickets                     - the sales ticket: sent -> booked / expired / cancelled
--             jobs.partner_sale                 - this job is a direct sale (no partner tier, no pro fee)
--             partner_commissions.tier          - + 'direct' (rate = the ladder rate locked at completion)
--             referral_customers.source         - + 'sale' (a customer the partner sold)
--             referral_partners.kind            - + 'sales_rep'
--           Staff read/write through the Hub; partners see their own tickets through the server. Safe to run twice.
-- ============================================================================
alter table public.referral_partners drop constraint if exists referral_partners_kind_check;
alter table public.referral_partners add constraint referral_partners_kind_check
  check (kind in ('realtor','property_manager','contractor','business','customer','pro','sales_rep','other'));

alter table public.referral_customers drop constraint if exists referral_customers_source_check;
alter table public.referral_customers add constraint referral_customers_source_check
  check (source in ('link','direct','staff','sale'));

alter table public.partner_commissions add column if not exists tier text;
alter table public.partner_commissions add column if not exists rate numeric(5,4);
alter table public.partner_commissions drop constraint if exists partner_commissions_tier_check;
alter table public.partner_commissions add constraint partner_commissions_tier_check
  check (tier is null or tier in ('one_time','repeat','account','legacy','direct'));

alter table public.jobs add column if not exists partner_sale boolean not null default false;

create table if not exists public.sales_tickets (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,                -- the customer's private pay link (/book?ticket=...)
  partner_id uuid not null references public.referral_partners(id) on delete cascade,
  service_slug text,
  photos text[] not null default '{}',
  notes text,
  customer_name text not null,
  customer_email text not null,              -- lower-case
  customer_phone text,
  address text,
  city text,
  state text,
  zip text,
  -- what it takes to close the sale: the customer pays from the ticket without being asked anything again
  answers jsonb not null default '{}'::jsonb, -- the service's questions + measurements (the price inputs)
  frequency text not null default 'once' check (frequency in ('once','weekly','biweekly','monthly','quarterly')),
  urgency text check (urgency in ('asap','this_week','two_weeks','month','flexible')),
  preferred_date date,
  time_window text not null default 'flexible' check (time_window in ('morning','midday','afternoon','flexible')),
  customer_type text not null default 'residential' check (customer_type in ('residential','commercial')),
  company_name text,
  budget numeric(12,2),
  access_notes text,                          -- gate code, pets, parking (only the assigned pro sees it)
  decision_maker boolean not null default false, -- the rep spoke with the person who decides and pays
  quoted_price numeric(12,2),                 -- the upfront price the rep showed (the booking re-prices; photos can adjust it)
  close_notes text,                           -- objections / what it takes to close (staff follow-up)
  consent_at timestamptz not null,           -- the rep confirmed the customer asked to hear from us
  status text not null default 'sent' check (status in ('sent','booked','expired','cancelled')),
  job_id uuid references public.jobs(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sales_tickets_partner_idx on public.sales_tickets (partner_id, created_at desc);
create index if not exists sales_tickets_status_idx on public.sales_tickets (status, created_at desc);

alter table public.sales_tickets enable row level security;
drop policy if exists staff_all on public.sales_tickets;
create policy staff_all on public.sales_tickets for all to authenticated using (public.is_staff()) with check (public.is_staff());
