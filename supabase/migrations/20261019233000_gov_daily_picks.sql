-- ============================================================================
-- FILE    : supabase/migrations/20261019233000_gov_daily_picks.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-19_2330 UTC
-- PURPOSE : The AI bid desk's daily picks (lib/gov.ts govDailyPicks) and the Deal hunter (lib/ai/deal-hunter.ts).
--             • gov_settings.daily_picks     — notices to pick each weekday to propose on (default 5)
--             • gov_opportunities.picked_at  — when the bid desk picked it (one pick per notice)
--             • daily SAM.gov call budget 8 → 10 (a personal key's limit) where it was still the default: the
--               state-wide search uses ~4 calls, the 5 bid briefs ~5
-- ============================================================================
alter table public.gov_settings add column if not exists daily_picks int not null default 5 check (daily_picks between 0 and 20);
alter table public.gov_opportunities add column if not exists picked_at timestamptz;
create index if not exists gov_opportunities_picked on public.gov_opportunities (picked_at);
update public.gov_settings set daily_call_budget = 10 where daily_call_budget = 8;
