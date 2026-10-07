-- ============================================================================
-- FILE    : supabase/setup/ADD_SERVICE_AREAS_AND_BID_MEASUREMENTS_2026-10-07_1640.sql
-- PROJECT : Handled Services LLC (myhumanai)
-- CREATED : 2026-10-07_1640 UTC
-- PURPOSE : For the EXISTING Supabase project: (1) new service areas outside Metro Detroit (rest of Michigan),
--           (2) bid measurements (size / unit on bid cost lines). Same as migrations 20261007030000_bid_measurements.sql and
--           20261007050000_more_service_areas.sql. Run once in Supabase -> SQL Editor. Safe to run twice.
-- ============================================================================
insert into public.markets (name, state, zip_prefixes)
select v.name, v.state, v.zips from (values
  ('Flint & Tri-Cities', 'MI', array['484','485','486','487']),
  ('Lansing', 'MI', array['488','489']),
  ('Kalamazoo & Battle Creek', 'MI', array['490','491']),
  ('Jackson', 'MI', array['492']),
  ('Grand Rapids & West Michigan', 'MI', array['493','494','495']),
  ('Northern Michigan', 'MI', array['496','497']),
  ('Upper Peninsula', 'MI', array['498','499'])
) as v(name, state, zips)
where not exists (select 1 from public.markets m where m.name = v.name);

alter table public.bid_cost_lines add column if not exists measure_size numeric check (measure_size is null or measure_size >= 0);
alter table public.bid_cost_lines add column if not exists measure_unit text;
