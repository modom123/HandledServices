-- ============================================================================
-- FILE    : supabase/migrations/20261007070000_washington_area_pricing.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-07_1830 UTC
-- PURPOSE : Area pricing for Washington (markets.price_multiplier, read by lib/launch regionFactor → estimate region):
--             Seattle area (Seattle & Eastside, Everett & North Sound, Tacoma & South Sound)  +25%  → 1.25
--             Rest of Washington (Olympia & Southwest WA, Central Washington, Spokane & Eastern WA, new areas)  +20%  → 1.20
--           Michigan stays 1.00. The pro's pay follows the price. Safe to run twice.
-- ============================================================================
update public.markets set price_multiplier = 1.25
 where state = 'WA' and name in ('Seattle & Eastside', 'Everett & North Sound', 'Tacoma & South Sound');
update public.markets set price_multiplier = 1.20
 where state = 'WA' and name not in ('Seattle & Eastside', 'Everett & North Sound', 'Tacoma & South Sound');
