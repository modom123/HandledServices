-- ============================================================================
-- FILE    : supabase/setup/ADD_PRO_SHOWCASE_2026-11-10_2000.sql (same as migration 20261110200000_pro_showcase.sql)
--           Run once in Supabase -> SQL Editor. Safe to run twice.
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-11-10_2000 UTC
-- PURPOSE : "New pros in the Handled Network" on the website. A pro is shown (photo, name, area, up to 5 services) only
--           after they opt in from the pro portal (My info → Feature me on the website). Opt-in is the pro's choice:
--           the pro agreement doesn't license their name or likeness for marketing.
--             contractors.showcase_opt_in     — they agreed to be featured (default false)
--             contractors.showcase_opt_in_at  — when they turned it on (null when off)
-- ============================================================================
alter table public.contractors add column if not exists showcase_opt_in boolean not null default false;
alter table public.contractors add column if not exists showcase_opt_in_at timestamptz;
create index if not exists contractors_showcase_idx on public.contractors (onboarded_at desc) where showcase_opt_in and status = 'approved';
