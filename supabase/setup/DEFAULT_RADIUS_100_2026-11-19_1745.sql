-- ============================================================================
-- FILE    : supabase/setup/DEFAULT_RADIUS_100_2026-11-19_1745.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-11-19_1745 UTC
-- PURPOSE : Paste into Supabase → SQL Editor. New pros get a 100-mile work area around their ZIP by default.
-- ============================================================================

-- 1) new pros: 100 miles
alter table contractors alter column service_radius_mi set default 100;

-- 2) OPTIONAL: move pros still on the old 25-mile default (and no ZIP list) to 100 miles.
--    Only run this if you want existing pros to get offers up to 100 miles away.
-- update contractors set service_radius_mi = 100
--   where service_radius_mi = 25 and coalesce(array_length(service_zips, 1), 0) = 0;
