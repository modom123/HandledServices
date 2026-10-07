-- ============================================================================
-- FILE    : supabase/migrations/20261005195400_bid_engine.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-05_1954 UTC
-- PURPOSE : The bid engine (packages/core/src/bid-engine.ts, Hub → Bids): one workspace per public bid.
--             • bids             — the bid: source, agency, deadlines, status, go / no-go answers, pricing assumptions,
--                                  review sign-off, submission and result (our price, winning price, winner)
--             • bid_requirements — the compliance matrix: every "shall / must", form, deadline and attachment, with
--                                  where our response answers it and who checked it off
--             • bid_cost_lines   — the price lines (item, unit, quantity per year, years, pro cost, materials, last award)
--             • bid_pro_quotes   — pros' written prices per line and capacity, collected through a private link
--             • bid_documents    — the solicitation, addenda, price form, drafts and the submission confirmation
--                                  (private storage bucket "bids")
--             • bid_benchmarks   — what work went for before (award notices, bid tabs, our own results), for pricing
--           Staff only; pros reach their own quote only through the token link (server-side).
-- ============================================================================
create table if not exists public.bids (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  agency text,
  source text not null default 'other' check (source in ('sam','city','county','state','school','private','other')),
  notice_id text references public.gov_opportunities(notice_id) on delete set null,
  solicitation_number text,
  link text,
  due_at timestamptz,
  questions_due_at timestamptz,
  submit_method text,
  term_years numeric,
  status text not null default 'draft' check (status in ('draft','no_bid','pricing','review','ready','submitted','won','lost','cancelled')),
  go jsonb not null default '{}'::jsonb,
  no_bid_reason text,
  assumptions jsonb not null default '{}'::jsonb,
  margin_override boolean not null default false,
  ai_summary jsonb,
  owner text,
  review jsonb not null default '{}'::jsonb,
  reviewer text,
  reviewed_at timestamptz,
  submitted_at timestamptz,
  submitted_by text,
  our_price numeric,
  award_amount numeric,
  winning_price numeric,
  winner text,
  result_note text,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bids_status on public.bids (status, due_at);
alter table public.bids enable row level security;
create policy staff_all on public.bids for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.bid_requirements (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid not null references public.bids(id) on delete cascade,
  kind text not null default 'requirement' check (kind in ('eligibility','form','requirement','insurance','price_form','deadline','question','attachment','evaluation')),
  text text not null,
  source_ref text,
  response_ref text,
  required boolean not null default true,
  done boolean not null default false,
  done_by text,
  done_at timestamptz,
  note text,
  origin text not null default 'manual' check (origin in ('standard','ai','manual')),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists bid_requirements_bid on public.bid_requirements (bid_id, kind, sort);
alter table public.bid_requirements enable row level security;
create policy staff_all on public.bid_requirements for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.bid_cost_lines (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid not null references public.bids(id) on delete cascade,
  item text not null,
  unit text not null default 'each',
  qty numeric not null default 0 check (qty >= 0),
  years numeric not null default 1 check (years >= 0),
  pro_unit_cost numeric check (pro_unit_cost is null or pro_unit_cost >= 0),
  materials_unit numeric not null default 0 check (materials_unit >= 0),
  benchmark numeric check (benchmark is null or benchmark >= 0),
  slug text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists bid_cost_lines_bid on public.bid_cost_lines (bid_id, sort);
alter table public.bid_cost_lines enable row level security;
create policy staff_all on public.bid_cost_lines for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.bid_pro_quotes (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid not null references public.bids(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  token text not null unique,
  status text not null default 'asked' check (status in ('asked','committed','declined')),
  prices jsonb not null default '{}'::jsonb,
  capacity text,
  small_business boolean,
  note text,
  asked_at timestamptz not null default now(),
  answered_at timestamptz,
  unique (bid_id, contractor_id)
);
alter table public.bid_pro_quotes enable row level security;
create policy staff_all on public.bid_pro_quotes for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.bid_documents (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid not null references public.bids(id) on delete cascade,
  kind text not null default 'other' check (kind in ('rfq','addendum','price_form','draft','confirmation','other')),
  name text not null,
  path text not null,
  size int,
  ai_read_at timestamptz,
  uploaded_by text,
  created_at timestamptz not null default now()
);
create index if not exists bid_documents_bid on public.bid_documents (bid_id, created_at);
alter table public.bid_documents enable row level security;
create policy staff_all on public.bid_documents for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.bid_benchmarks (
  id uuid primary key default gen_random_uuid(),
  item text not null,
  unit text not null,
  price numeric not null check (price >= 0),
  agency text,
  source text,
  award_date date,
  bid_id uuid references public.bids(id) on delete set null,
  note text,
  created_by text,
  created_at timestamptz not null default now()
);
alter table public.bid_benchmarks enable row level security;
create policy staff_all on public.bid_benchmarks for all to authenticated using (public.is_staff()) with check (public.is_staff());

insert into storage.buckets (id, name, public) values ('bids', 'bids', false) on conflict (id) do nothing;
