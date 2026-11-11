-- ============================================================================
-- FILE    : supabase/migrations/20261111010000_biz_lead_refresh.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-11-11_0100 UTC
-- PURPOSE : Keep the business lead list fresh, and send from Handled's own outreach domain instead of Instantly.
--             statuses resting (between rounds) and retired (done for a year, or a duplicate)
--             round, rest_until, retired_at, retired_reason — the refresh cycle (core LEAD_REFRESH / refreshStep)
--             dedupe_key — one business across sources (website / email domain / phone; core bizDedupeKey)
--             seq_step, next_send_at, sent_via — our own 3-email sequence (lib/outreach-mail.ts, OUTREACH_* mailbox)
--             settings: sender ('instantly' | 'own'), rest_days, max_rounds, first_own_send_at (warm-up ramp)
--           Safe to run twice.
-- ============================================================================
alter table public.biz_leads drop constraint if exists biz_leads_status_check;
alter table public.biz_leads add constraint biz_leads_status_check check (status in
  ('new','queued','emailing','clicked','replied','converted','call','not_interested','unsubscribed','bounced','do_not_contact','resting','retired'));
alter table public.biz_leads add column if not exists round int not null default 1;
alter table public.biz_leads add column if not exists rest_until timestamptz;
alter table public.biz_leads add column if not exists retired_at timestamptz;
alter table public.biz_leads add column if not exists retired_reason text;
alter table public.biz_leads add column if not exists dedupe_key text;
alter table public.biz_leads add column if not exists seq_step int not null default 0;
alter table public.biz_leads add column if not exists next_send_at timestamptz;
alter table public.biz_leads add column if not exists sent_via text;
create index if not exists biz_leads_dedupe_idx on public.biz_leads (dedupe_key);
create index if not exists biz_leads_next_send_idx on public.biz_leads (next_send_at) where next_send_at is not null;
create index if not exists biz_leads_rest_idx on public.biz_leads (rest_until) where status = 'resting';

alter table public.biz_lead_settings add column if not exists sender text not null default 'instantly';
alter table public.biz_lead_settings drop constraint if exists biz_lead_settings_sender_check;
alter table public.biz_lead_settings add constraint biz_lead_settings_sender_check check (sender in ('instantly','own'));
alter table public.biz_lead_settings add column if not exists rest_days int not null default 90;
alter table public.biz_lead_settings drop constraint if exists biz_lead_settings_rest_days_check;
alter table public.biz_lead_settings add constraint biz_lead_settings_rest_days_check check (rest_days between 30 and 365);
alter table public.biz_lead_settings add column if not exists max_rounds int not null default 2;
alter table public.biz_lead_settings drop constraint if exists biz_lead_settings_max_rounds_check;
alter table public.biz_lead_settings add constraint biz_lead_settings_max_rounds_check check (max_rounds between 1 and 4);
alter table public.biz_lead_settings add column if not exists first_own_send_at timestamptz;
alter table public.biz_lead_settings add column if not exists outreach_last_uid bigint not null default 0;
