-- ============================================================================
-- FILE    : supabase/migrations/20261007030000_bid_measurements.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-07_0300 UTC
-- PURPOSE : Bid engine measurements: the size of ONE unit of work on a price line (e.g. a 12-acre mowing visit,
--           a 40 cu yd clean-out), so the engine can estimate the pro cost from our pricing engine and the
--           deal-maker can price it. Safe to run twice.
-- ============================================================================
alter table public.bid_cost_lines add column if not exists measure_size numeric check (measure_size is null or measure_size >= 0);
alter table public.bid_cost_lines add column if not exists measure_unit text;
