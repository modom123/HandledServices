-- ============================================================================
-- FILE    : supabase/setup/ADD_FIELD_SALES_2026-11-06_1638.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-11-06_1638 UTC
-- PURPOSE : Run once in Supabase -> SQL Editor (same as migration 20261106163800_field_sales.sql). Field Sales (Partner Program). A partner (part-time / full-time sales rep) takes 3-4 photos and writes a
--           ticket for a customer; the customer gets a link to see the price, accept the terms and pay; the paid job
--           goes to the job board like any booking. Commissions climb a ladder from 10% to 45% of Handled's take
--           (rules: packages/core/src/partners.ts, PARTNER_LADDER).
--             sales_tickets              - the rep's ticket: everything needed to close (service + measurements, photos,
--                                          customer, address, timing, budget, decision maker, quoted price);
--                                          status sent -> booked / expired / cancelled. Remote services need no photos.
--             jobs paid with a rep's code - typing a partner code at checkout credits that partner (lib/partners.ts)
--             partner_commissions.rate   - the ladder rate locked in when the job was completed
--             partner_commissions.source - 'direct' (a ticket the partner closed) or 'referral' (the two ways to earn)
--             referral_partners.kind     - + 'sales_rep'
--             referral_customers.source  - + 'ticket'
--           Staff read/write through the Hub; reps see their own tickets through the server. Safe to run twice.
-- ============================================================================
alter table public.referral_partners drop constraint if exists referral_partners_kind_check;
alter table public.referral_partners add constraint referral_partners_kind_check
  check (kind in ('realtor','property_manager','contractor','business','customer','pro','sales_rep','other'));

alter table public.referral_customers drop constraint if exists referral_customers_source_check;
alter table public.referral_customers add constraint referral_customers_source_check
  check (source in ('link','direct','staff','ticket'));

alter table public.partner_commissions add column if not exists rate numeric(5,4) not null default 0.10
  check (rate >= 0 and rate <= 0.45);
-- the two ways to earn: 'direct' = a Field Sales ticket the partner closed, 'referral' = link / code / sent customer
alter table public.partner_commissions add column if not exists source text not null default 'referral'
  check (source in ('direct','referral'));

create table if not exists public.sales_tickets (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,                -- the customer's private link (/book?ticket=...)
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
