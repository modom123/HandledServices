-- ============================================================================
-- FILE    : supabase/migrations/20261119174500_default_radius_100.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-11-19_1745 UTC
-- PURPOSE : A pro's default work area is 100 miles around their ZIP (owner, 2026-11-19). Listing ZIP codes replaces it.
--           New pros start at 100. Existing pros keep what they saved.
-- ============================================================================
alter table contractors alter column service_radius_mi set default 100;
