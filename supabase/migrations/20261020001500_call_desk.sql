-- ============================================================================
-- FILE    : supabase/migrations/20261020001500_call_desk.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-20_0015 UTC
-- PURPOSE : The Call desk (Hub → Business leads → Call desk; packages/core/src/call-desk.ts):
--             • biz_leads.next_call_at / call_attempts / last_call_outcome / last_called_at — the call queue and follow-ups
--             • biz_lead_settings.call_goal — dials a day (default 30)
--           Each call is also an event on the lead's history (kind 'call:<outcome>').
-- ============================================================================
alter table public.biz_leads add column if not exists next_call_at timestamptz;
alter table public.biz_leads add column if not exists call_attempts int not null default 0;
alter table public.biz_leads add column if not exists last_call_outcome text;
alter table public.biz_leads add column if not exists last_called_at timestamptz;
create index if not exists biz_leads_next_call on public.biz_leads (next_call_at);
alter table public.biz_lead_settings add column if not exists call_goal int not null default 30 check (call_goal between 0 and 500);
