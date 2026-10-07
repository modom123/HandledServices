-- ============================================================================
-- FILE    : supabase/setup/ADD_WASHINGTON_AREA_PRICING_2026-10-07_1830.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-10-07_1830 UTC
-- PURPOSE : For the EXISTING Supabase project: Washington prices — Seattle area +25%, rest of Washington +20%.
--           Run AFTER ADD_WASHINGTON_SERVICE_AREAS_2026-10-07_1700.sql. Same as migration 20261007070000_washington_area_pricing.sql.
--           Run once in Supabase -> SQL Editor. Safe to run twice. Change a number any time and re-run.
-- ============================================================================
update public.markets set price_multiplier = 1.25
 where state = 'WA' and name in ('Seattle & Eastside', 'Everett & North Sound', 'Tacoma & South Sound');
update public.markets set price_multiplier = 1.20
 where state = 'WA' and name not in ('Seattle & Eastside', 'Everett & North Sound', 'Tacoma & South Sound');
