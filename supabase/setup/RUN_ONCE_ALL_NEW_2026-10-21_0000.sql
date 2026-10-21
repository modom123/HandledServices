-- ============================================================================
-- FILE    : supabase/setup/RUN_ONCE_ALL_NEW_2026-10-21_0000.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-10-21_0000 UTC
-- PURPOSE : ONE paste for the EXISTING Supabase project — every database change from 2026-10-19 to 2026-10-21, in order:
--             1. SAM.gov contract awards          (ADD_GOV_CONTRACT_AWARDS_2026-10-19_2015.sql)
--             2. Subcontracting + focus trades    (ADD_GOV_SUBCONTRACTING_2026-10-19_2140.sql)
--             3. Instantly → CRM sync             (ADD_INSTANTLY_CRM_SYNC_2026-10-19_2230.sql)
--             4. AI bid desk: 5 gov bids a day    (ADD_GOV_DAILY_PICKS_2026-10-19_2330.sql)
--             5. Call desk                        (ADD_CALL_DESK_2026-10-20_0015.sql)
--             6. Omnichannel: lead inbox, social  (ADD_OMNICHANNEL_2026-10-20_0100.sql)
--             7. Pro marketplace + quotes         (ADD_PRO_MARKETPLACE_2026-10-20_0200.sql)
--           Supabase -> SQL Editor -> New query -> paste this whole file -> Run. Safe to run twice.
-- ============================================================================

-- 1. ADD_GOV_CONTRACT_AWARDS_2026-10-19_2015 ─────────────────────────────────────────────
create table if not exists public.gov_awards (
  award_key text primary key,
  piid text not null,
  referenced_idv_piid text,
  modification_number text,
  agency text,
  subtier text,
  office text,
  awardee text,
  awardee_uei text,
  awardee_city text,
  awardee_state text,
  naics text,
  naics_title text,
  psc text,
  psc_title text,
  set_aside_code text,
  set_aside text,
  description text,
  solicitation_id text,
  offers_received int,
  date_signed date,
  pop_start date,
  current_end date,
  ultimate_end date,
  obligated numeric,
  total_value numeric,
  pop_city text,
  pop_state text,
  pop_zip text,
  fit_score int not null default 0,
  fit jsonb,
  services text[] not null default '{}'::text[],
  status text not null default 'new' check (status in ('new','watching','ignored')),
  notes text,
  raw jsonb,
  first_seen timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gov_awards_fit on public.gov_awards (status, fit_score desc);
create index if not exists gov_awards_end on public.gov_awards (ultimate_end);
create index if not exists gov_awards_awardee on public.gov_awards (awardee_uei);
alter table public.gov_awards enable row level security;
drop policy if exists staff_all on public.gov_awards;
create policy staff_all on public.gov_awards for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.gov_settings add column if not exists awards_enabled boolean not null default false;
alter table public.gov_settings add column if not exists awards_months_back int not null default 24 check (awards_months_back between 1 and 60);
alter table public.gov_settings add column if not exists awards_pages int not null default 2 check (awards_pages between 1 and 20);

alter table public.gov_api_calls drop constraint if exists gov_api_calls_kind_check;
alter table public.gov_api_calls add constraint gov_api_calls_kind_check check (kind in ('search','description','awards'));

-- 2. ADD_GOV_SUBCONTRACTING_2026-10-19_2140 ─────────────────────────────────────────────
alter table public.gov_awards add column if not exists awardee_phone text;
alter table public.gov_awards add column if not exists awardee_address text;
alter table public.gov_awards add column if not exists awardee_size text;
alter table public.gov_awards add column if not exists subcontract_plan text;
alter table public.gov_awards add column if not exists sub_score int not null default 0;
alter table public.gov_awards add column if not exists sub_fit jsonb;
create index if not exists gov_awards_sub on public.gov_awards (sub_score desc);

alter table public.gov_settings add column if not exists awards_naics text[] not null default array['561730','238320','541511','541512','541519','238150','561740','236220','236118']::text[];
update public.gov_settings set naics = array['561730','238320','541511','541512','541519','238150','561740','236220','236118']::text[]
  where naics = array['561720','561730','561790','561612','562111','484210']::text[];

-- 3. ADD_INSTANTLY_CRM_SYNC_2026-10-19_2230 ─────────────────────────────────────────────
alter table public.biz_leads drop constraint if exists biz_leads_source_check;
alter table public.biz_leads add constraint biz_leads_source_check check (source in ('google_places','csv','manual','job_board','instantly'));

-- 4. ADD_GOV_DAILY_PICKS_2026-10-19_2330 ─────────────────────────────────────────────
alter table public.gov_settings add column if not exists daily_picks int not null default 5 check (daily_picks between 0 and 20);
alter table public.gov_opportunities add column if not exists picked_at timestamptz;
create index if not exists gov_opportunities_picked on public.gov_opportunities (picked_at);
update public.gov_settings set daily_call_budget = 10 where daily_call_budget = 8;

-- 5. ADD_CALL_DESK_2026-10-20_0015 ─────────────────────────────────────────────
alter table public.biz_leads add column if not exists next_call_at timestamptz;
alter table public.biz_leads add column if not exists call_attempts int not null default 0;
alter table public.biz_leads add column if not exists last_call_outcome text;
alter table public.biz_leads add column if not exists last_called_at timestamptz;
create index if not exists biz_leads_next_call on public.biz_leads (next_call_at);
alter table public.biz_lead_settings add column if not exists call_goal int not null default 30 check (call_goal between 0 and 500);

-- 6. ADD_OMNICHANNEL_2026-10-20_0100 ─────────────────────────────────────────────
alter table public.leads add column if not exists channel text not null default 'website';
alter table public.leads add column if not exists company text;
alter table public.leads add column if not exists city text;
alter table public.leads add column if not exists campaign text;
alter table public.leads add column if not exists attribution jsonb;
alter table public.leads add column if not exists status text not null default 'new';
alter table public.leads add column if not exists sms_consent boolean not null default false;
alter table public.leads add column if not exists external_id text;
alter table public.leads add column if not exists first_reply_at timestamptz;
alter table public.leads add column if not exists contacted_at timestamptz;
alter table public.leads add column if not exists handled_by text;
alter table public.leads add column if not exists biz_lead_id uuid references public.biz_leads(id) on delete set null;
alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check check (status in ('new','contacted','booked','lost','spam'));
create unique index if not exists leads_channel_external on public.leads (channel, external_id) where external_id is not null;
create index if not exists leads_status_created on public.leads (status, created_at desc);
create index if not exists leads_channel_created on public.leads (channel, created_at desc);

-- inbound business leads land in the CRM too (source 'inbound'), at the top of the Call desk
alter table public.biz_leads drop constraint if exists biz_leads_source_check;
alter table public.biz_leads add constraint biz_leads_source_check check (source in ('google_places','csv','manual','job_board','instantly','inbound'));

create table if not exists public.social_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  auto_publish boolean not null default false,
  per_week jsonb not null default '{"facebook":3,"instagram":3,"tiktok":2}'::jsonb,
  themes text,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.social_settings enable row level security;
drop policy if exists staff_all on public.social_settings;
create policy staff_all on public.social_settings for all to authenticated using (public.is_staff()) with check (public.is_staff());
insert into public.social_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('facebook','instagram','tiktok')),
  scheduled_for timestamptz not null,
  status text not null default 'draft' check (status in ('draft','approved','posted','failed','skipped')),
  caption text not null,
  hashtags text[] not null default '{}'::text[],
  media_idea text,
  media_url text,
  service_slug text,
  external_id text,
  error text,
  created_by text not null default 'AI social writer',
  approved_by text,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists social_posts_when on public.social_posts (status, scheduled_for);
alter table public.social_posts enable row level security;
drop policy if exists staff_all on public.social_posts;
create policy staff_all on public.social_posts for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- 7. ADD_PRO_MARKETPLACE_2026-10-20_0200 ─────────────────────────────────────────────
create table if not exists public.pro_rates (
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  service_slug text not null,
  pct int not null check (pct between 80 and 175),
  min_job numeric check (min_job is null or min_job between 0 and 100000),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (contractor_id, service_slug)
);
create index if not exists pro_rates_service on public.pro_rates (service_slug) where active;
alter table public.pro_rates enable row level security;
drop policy if exists staff_all on public.pro_rates;
create policy staff_all on public.pro_rates for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.jobs add column if not exists priced_by text check (priced_by is null or priced_by in ('engine','offer','pro_rate','quote'));
alter table public.jobs add column if not exists pro_rate_pct int;

create table if not exists public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 24),
  customer_id uuid references public.profiles(id) on delete set null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  service_slug text not null,
  description text not null,
  zip text not null,
  city text,
  preferred_date date,
  photos text[] not null default '{}'::text[],
  status text not null default 'open' check (status in ('open','quoted','booked','expired','cancelled')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  job_id uuid references public.jobs(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists quote_requests_status on public.quote_requests (status, created_at desc);
alter table public.quote_requests enable row level security;
drop policy if exists staff_all on public.quote_requests;
create policy staff_all on public.quote_requests for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.quote_bids (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.quote_requests(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  token text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 24),
  status text not null default 'invited' check (status in ('invited','quoted','declined','expired','chosen','lost')),
  pay numeric check (pay is null or pay > 0),
  price numeric check (price is null or price > 0),
  earliest_date date,
  note text,
  invited_at timestamptz not null default now(),
  quoted_at timestamptz,
  unique (request_id, contractor_id)
);
create index if not exists quote_bids_request on public.quote_bids (request_id);
alter table public.quote_bids enable row level security;
drop policy if exists staff_all on public.quote_bids;
create policy staff_all on public.quote_bids for all to authenticated using (public.is_staff()) with check (public.is_staff());
