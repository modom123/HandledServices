-- ============================================================================
-- FILE    : supabase/setup/ADD_REFERRAL_PARTNERS_2026-10-07_0100.sql
-- PROJECT : Handled Services LLC (myhumanai) — Referral Partner Program
-- CREATED : 2026-10-07_0100 UTC
-- PURPOSE : Turns on the Referral Partner Program in the EXISTING Supabase project (/partners, /partner,
--           Hub → Referral partners). Same as migration 20261007010000_referral_partners.sql.
--           Run once in Supabase → SQL Editor. Safe to run twice.
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
