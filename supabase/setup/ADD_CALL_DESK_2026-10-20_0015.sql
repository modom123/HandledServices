-- ============================================================================
-- FILE    : supabase/setup/ADD_CALL_DESK_2026-10-20_0015.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-10-20_0015 UTC
-- PURPOSE : ONE paste for the EXISTING Supabase project — the Call desk = migration 20261020001500_call_desk.sql.
--           Supabase -> SQL Editor -> paste this whole file -> Run. Safe to run twice.
-- ============================================================================

alter table public.biz_leads add column if not exists next_call_at timestamptz;
alter table public.biz_leads add column if not exists call_attempts int not null default 0;
alter table public.biz_leads add column if not exists last_call_outcome text;
alter table public.biz_leads add column if not exists last_called_at timestamptz;
create index if not exists biz_leads_next_call on public.biz_leads (next_call_at);
alter table public.biz_lead_settings add column if not exists call_goal int not null default 30 check (call_goal between 0 and 500);
