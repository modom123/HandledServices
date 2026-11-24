-- ============================================================================
-- FILE    : supabase/migrations/20261117233500_ai_outreach_handledsvc_net.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-11-17_2335 UTC
-- PURPOSE : AI email outreach from handledsvc.net (the marketing / outreach domain).
--             settings.ai_personalize   — the AI writer personalizes each cold email (guardrails in core outreach-ai.ts)
--             thread_message_id/subject — email 1's Message-ID, so follow-ups reply in the same thread
--             reply_*                   — the business's last reply (their words, Message-ID, subject), the AI's
--                                         checked draft answer and when staff answered it from the Hub
--           Safe to run twice.
-- ============================================================================
alter table public.biz_lead_settings add column if not exists ai_personalize boolean not null default true;

alter table public.biz_leads add column if not exists thread_message_id text;
alter table public.biz_leads add column if not exists thread_subject text;
alter table public.biz_leads add column if not exists reply_text text;
alter table public.biz_leads add column if not exists reply_message_id text;
alter table public.biz_leads add column if not exists reply_references text;
alter table public.biz_leads add column if not exists reply_subject text;
alter table public.biz_leads add column if not exists reply_at timestamptz;
alter table public.biz_leads add column if not exists reply_draft text;
alter table public.biz_leads add column if not exists reply_intent text;
alter table public.biz_leads add column if not exists reply_answered_at timestamptz;
create index if not exists biz_leads_reply_waiting_idx on public.biz_leads (reply_at) where reply_at is not null and reply_answered_at is null;
