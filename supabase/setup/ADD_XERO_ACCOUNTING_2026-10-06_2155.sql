-- ============================================================================
-- FILE    : supabase/setup/ADD_XERO_ACCOUNTING_2026-10-06_2155.sql
-- PROJECT : Handled Services LLC (HandledServices) — Hub → Accounting (Xero)
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
