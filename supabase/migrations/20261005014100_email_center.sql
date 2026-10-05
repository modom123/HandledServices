-- ============================================================================
-- FILE    : supabase/migrations/20261005014100_email_center.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-05_0148 UTC
-- PURPOSE : Email Center (Hub → Email): marketing campaigns sent from the company mailbox
--           (Hostinger SMTP, info@handledsvc.com), a trickle send by the 10-minute cron, click tracking,
--           and the shared unsubscribe list (email_optouts).
--             • email_campaigns            — draft → scheduled → sending → sent (or paused / cancelled)
--             • email_campaign_recipients  — one row per person per campaign (queued → sent / failed / skipped)
--             • email_center_settings      — sender name, reply-to, daily cap, per-run pace
--             • marketing_sends.kind adds 'campaign' (one marketing email a week per person, across all)
-- ============================================================================
create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  subject text not null default '',
  preheader text,
  body text not null default '',
  subject_es text,
  body_es text,
  audience text not null check (audience in ('customers','repeat_customers','lapsed_customers','business_accounts','biz_leads','pros','custom')),
  custom_list text,
  custom_consent boolean not null default false,
  status text not null default 'draft' check (status in ('draft','scheduled','sending','sent','paused','cancelled')),
  scheduled_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  recipients int not null default 0,
  sent int not null default 0,
  failed int not null default 0,
  skipped int not null default 0,
  clicks int not null default 0,
  unsubscribes int not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.email_campaigns enable row level security;
create policy staff_all on public.email_campaigns for all to authenticated using (public.is_staff()) with check (public.is_staff());
create index if not exists email_campaigns_status_idx on public.email_campaigns (status, scheduled_at);

create table if not exists public.email_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.email_campaigns(id) on delete cascade,
  email text not null check (email = lower(email) and position('@' in email) > 1),
  name text,
  locale text not null default 'en' check (locale in ('en','es')),
  vars jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued','sent','failed','skipped')),
  error text,
  sent_at timestamptz,
  clicked_at timestamptz,
  clicks int not null default 0,
  unique (campaign_id, email)
);
alter table public.email_campaign_recipients enable row level security;
create policy staff_all on public.email_campaign_recipients for all to authenticated using (public.is_staff()) with check (public.is_staff());
create index if not exists email_recipients_queue_idx on public.email_campaign_recipients (campaign_id, status);

create table if not exists public.email_center_settings (
  id int primary key default 1 check (id = 1),
  from_name text not null default 'Handled',
  reply_to text,
  daily_cap int not null default 250 check (daily_cap between 1 and 1000),
  per_run int not null default 25 check (per_run between 1 and 60),
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.email_center_settings enable row level security;
create policy staff_all on public.email_center_settings for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.marketing_sends drop constraint if exists marketing_sends_kind_check;
alter table public.marketing_sends add constraint marketing_sends_kind_check
  check (kind in ('seasonal','quote_followup','booking_followup','campaign'));
