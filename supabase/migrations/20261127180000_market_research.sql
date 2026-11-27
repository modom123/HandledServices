-- ============================================================================
-- FILE    : supabase/migrations/20261127180000_market_research.sql (same as setup/RUN_ONCE_MARKET_RESEARCH_2026-11-27_1800.sql)
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-11-27_1800 UTC
-- PURPOSE : Market research for the AI quote (owner, 2026-11-27: the AI quoting learns from market research and booked
--           jobs). What other companies charge for a typical job, per service and ZIP area ('all' or the first 3 digits),
--           entered in Hub -> Pricing -> Market research. The daily learning (lib/market.ts refreshMarketFactors) counts
--           each entry alongside pro offer outcomes and finished jobs (core quote-learning.ts). Server-only. Safe to run twice.
-- ============================================================================
create table if not exists public.market_research (
  id uuid primary key default gen_random_uuid(),
  service_slug text not null,
  area text not null default 'all' check (area = 'all' or area ~ '^[0-9]{3}$'),
  low numeric(10,2),
  typical numeric(10,2) not null check (typical > 0),
  high numeric(10,2),
  source text,
  note text,
  researched_on date not null default current_date,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists market_research_service on public.market_research (service_slug, area, researched_on desc);
alter table public.market_research enable row level security;
