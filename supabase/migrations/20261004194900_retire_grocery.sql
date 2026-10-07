-- ============================================================================
-- FILE    : supabase/migrations/20261004194900_retire_grocery.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-04_1949 UTC
-- PURPOSE : Grocery pickup & delivery is no longer offered (replaced by Same-Day Courier). Its catalog row
--           stays for any past jobs but is marked inactive; the new courier row is added by the catalog sync.
-- ============================================================================
update public.services set active = false where slug = 'grocery-delivery';
