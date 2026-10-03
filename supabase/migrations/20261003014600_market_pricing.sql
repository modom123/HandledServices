-- ============================================================================
-- FILE    : supabase/migrations/20261003014600_market_pricing.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-03_0146 UTC
-- PURPOSE : Market pricing — the market sets the price, inside guardrails:
--             • jobs.suggested_price / customer_offer — our suggestion vs. what the customer offered
--             • job_offers counter — a pro can say "I'll do it for $X" (status 'countered');
--               the customer accepts (pays the difference) or not
--             • price_signals    — every accept / decline / counter / expiry vs. the suggestion
--             • market_factors   — what we learned per service (and ZIP area): the suggested price
--                                  moves toward what pros actually accept, bounded 0.85–1.30×,
--                                  with a manual override in Hub → Market pricing
-- ============================================================================
alter type offer_status add value if not exists 'countered';

alter table public.job_offers
  add column if not exists counter_payout numeric(10,2),
  add column if not exists counter_price numeric(10,2),
  add column if not exists counter_note text,
  add column if not exists countered_at timestamptz;

alter table public.jobs
  add column if not exists suggested_price numeric(10,2),
  add column if not exists customer_offer numeric(10,2),
  add column if not exists booking_fee numeric(10,2) not null default 0,
  add column if not exists offer_nudged_at timestamptz,
  add column if not exists pending_counter_offer uuid references public.job_offers(id) on delete set null,
  add column if not exists pending_raise numeric(10,2);

create table if not exists public.price_signals (
  id uuid primary key default gen_random_uuid(),
  service_slug text not null,
  area text not null,               -- first 3 digits of the ZIP
  price numeric(10,2) not null,
  suggested numeric(10,2) not null,
  outcome text not null check (outcome in ('accepted','declined','countered','expired')),
  counter numeric(10,2),
  job_id uuid references public.jobs(id) on delete set null,
  contractor_id uuid references public.contractors(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.price_signals enable row level security;
create index if not exists price_signals_lookup_idx on public.price_signals (service_slug, area, created_at desc);

create table if not exists public.market_factors (
  service_slug text not null,
  area text not null default 'all',
  factor numeric(4,2) not null default 1 check (factor between 0.5 and 2),
  samples int not null default 0,
  target numeric(5,2),
  manual_factor numeric(4,2) check (manual_factor is null or manual_factor between 0.5 and 2),
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (service_slug, area)
);
alter table public.market_factors enable row level security;
create policy "market factors are public" on public.market_factors for select using (true);

-- Raising an offer / accepting a counter is its own payment kind.
alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check
  check (kind in ('deposit','final','milestone','plan','upfront','refund','balance','change_order','offer_raise','custom','materials','tip','gift_card','membership'));
