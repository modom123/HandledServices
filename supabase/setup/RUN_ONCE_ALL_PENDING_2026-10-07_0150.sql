-- ============================================================================
-- FILE    : supabase/setup/RUN_ONCE_ALL_PENDING_2026-10-07_0150.sql
-- PROJECT : Handled Services LLC (myhumanai)
-- CREATED : 2026-10-07_0150 UTC
-- PURPOSE : Everything the EXISTING Supabase project still needs, in one paste:
--             1. Xero accounting            (ADD_XERO_ACCOUNTING_2026-10-06_2155.sql)
--             2. Referral partner program   (ADD_REFERRAL_PARTNERS_2026-10-07_0100.sql)
--             3. Website settings + the fix that lets discounted bookings through
--                                           (ADD_SITE_SETTINGS_GRAND_OPENING_2026-10-07_0230.sql)
--           Supabase → SQL Editor → New query → paste ALL of this → Run. Safe to run more than once.
-- ============================================================================


-- >>> ADD_XERO_ACCOUNTING_2026-10-06_2155.sql
-- ============================================================================
-- FILE    : supabase/setup/ADD_XERO_ACCOUNTING_2026-10-06_2155.sql
-- PROJECT : Handled Services LLC (myhumanai) — Hub → Accounting (Xero)
-- CREATED : 2026-10-06_2155 UTC
-- PURPOSE : Turns on Xero accounting in the EXISTING Supabase project. Same as migration
--           20261006215500_xero_accounting.sql. Run once in Supabase → SQL Editor. Safe to run twice.
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


-- >>> ADD_REFERRAL_PARTNERS_2026-10-07_0100.sql
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


-- >>> ADD_SITE_SETTINGS_GRAND_OPENING_2026-10-07_0230.sql
-- ============================================================================
-- FILE    : supabase/setup/ADD_SITE_SETTINGS_GRAND_OPENING_2026-10-07_0230.sql
-- PROJECT : Handled Services LLC (myhumanai) — Website looks + grand opening promotion
-- CREATED : 2026-10-07_0230 UTC
-- PURPOSE : For the EXISTING Supabase project: settings table for Hub → Website & promotions, and the fix that lets
--           discounted bookings through the take-rate guard. Same as migration 20261007023000_site_settings_grand_opening.sql.
--           Run once in Supabase → SQL Editor. Safe to run twice.
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
