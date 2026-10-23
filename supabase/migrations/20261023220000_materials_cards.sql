-- ============================================================================
-- FILE    : supabase/migrations/20261023220000_materials_cards.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-23_2200 UTC
-- PURPOSE : Materials on the quote, on a card hold, and on a Handled materials card (Stripe Issuing):
--             • jobs.materials_low / materials_high / materials_note — the at-cost materials range shown on the quote
--             • jobs.materials_hold_intent — the high end held on the customer's card when the pro starts;
--               materials_settled_at — when the receipts were charged from it and the rest let go
--             • contractors — Stripe Issuing cardholder and card, the Authorized User Terms acceptance
--               (date + IP, which Stripe requires), and card_job_id: the job the card is spending on right now
--             • job_expenses — card swipes as well as receipts (source), the approved vendor and merchant,
--               the Stripe authorization / transaction ids; a card swipe can wait for its receipt photo
--             • approved_vendors — the Hub's changes to the built-in approved vendor list (packages/core/src/materials.ts):
--               a row with a built-in id overrides it (e.g. turned off), any other row adds a vendor
--             • materials_card_events — every card swipe decision, approved or declined, with the reason
--           Safe to run twice.
-- ============================================================================
alter table public.jobs
  add column if not exists materials_low numeric(10,2),
  add column if not exists materials_high numeric(10,2),
  add column if not exists materials_note text,
  add column if not exists materials_hold_intent text,
  add column if not exists materials_settled_at timestamptz;

alter table public.contractors
  add column if not exists stripe_cardholder_id text,
  add column if not exists materials_card_id text,
  add column if not exists materials_card_last4 text,
  add column if not exists materials_card_status text,
  add column if not exists card_terms_accepted_at timestamptz,
  add column if not exists card_terms_ip text,
  add column if not exists card_job_id uuid references public.jobs(id) on delete set null;

alter table public.job_expenses alter column receipt_path drop not null;
alter table public.job_expenses
  add column if not exists source text not null default 'receipt',
  add column if not exists vendor_id text,
  add column if not exists merchant_name text,
  add column if not exists stripe_authorization_id text,
  add column if not exists stripe_transaction_id text;
alter table public.job_expenses drop constraint if exists job_expenses_source_check;
alter table public.job_expenses add constraint job_expenses_source_check check (source in ('receipt','card'));
create unique index if not exists job_expenses_authorization_uidx on public.job_expenses (stripe_authorization_id) where stripe_authorization_id is not null;

create table if not exists public.approved_vendors (
  id text primary key,
  name text not null,
  match text[] not null default '{}',
  groups text[] not null default '{}',
  online boolean not null default false,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.approved_vendors enable row level security;
drop policy if exists staff_all on public.approved_vendors;
create policy staff_all on public.approved_vendors for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists vendors_read on public.approved_vendors;
create policy vendors_read on public.approved_vendors for select to authenticated using (true);

create table if not exists public.materials_card_events (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid references public.contractors(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  stripe_authorization_id text,
  amount numeric(10,2) not null,
  merchant_name text,
  merchant_category text,
  approved boolean not null,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists materials_card_events_job_idx on public.materials_card_events (job_id);
create index if not exists materials_card_events_pro_idx on public.materials_card_events (contractor_id, created_at desc);
alter table public.materials_card_events enable row level security;
drop policy if exists staff_all on public.materials_card_events;
create policy staff_all on public.materials_card_events for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists card_events_pro_read on public.materials_card_events;
create policy card_events_pro_read on public.materials_card_events for select to authenticated using (contractor_id = public.my_contractor_id());
