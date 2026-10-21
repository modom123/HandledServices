-- ============================================================================
-- FILE    : supabase/setup/ADD_OMNICHANNEL_2026-10-20_0100.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-10-20_0100 UTC
-- PURPOSE : ONE paste for the EXISTING Supabase project — Lead inbox (every channel, speed to lead), and the AI social
--           calendar = migration 20261020010000_omnichannel.sql. Run after the earlier ADD_* files from 2026-10-19/20.
--           Supabase -> SQL Editor -> paste this whole file -> Run. Safe to run twice.
-- ============================================================================

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
