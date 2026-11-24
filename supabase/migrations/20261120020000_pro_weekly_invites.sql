-- ============================================================================
-- FILE    : supabase/migrations/20261120020000_pro_weekly_invites.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-11-20_0200 UTC
-- PURPOSE : Pro invitations from our own mailbox: one email a week for 60 days (or 90), then the lead is retired.
-- ============================================================================
alter table public.pro_leads drop constraint if exists pro_leads_status_check;
alter table public.pro_leads add constraint pro_leads_status_check check (status in
  ('new','queued','emailing','clicked','replied','applied','call','not_interested','unsubscribed','bounced','do_not_contact','retired'));
alter table public.pro_leads add column if not exists first_email_at timestamptz;
alter table public.pro_leads add column if not exists retired_at timestamptz;
alter table public.lead_engine_settings add column if not exists invite_days int not null default 60;
alter table public.lead_engine_settings drop constraint if exists lead_engine_settings_invite_days_check;
alter table public.lead_engine_settings add constraint lead_engine_settings_invite_days_check check (invite_days between 14 and 180);
create index if not exists pro_leads_next_send_idx on public.pro_leads (next_send_at) where status in ('emailing','clicked');
