-- ============================================================================
-- FILE    : supabase/migrations/20261007050000_more_service_areas.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-07_1640 UTC
-- PURPOSE : Service areas beyond Metro Detroit (480–483): the rest of Michigan by region, plus Toledo, Ohio.
--           No launch list, so every service can be booked there. A booking still needs a vetted pro who covers the
--           ZIP (no pro → waitlist, nothing charged). Booked ZIPs outside every area join "<State> — new areas"
--           automatically (lib/launch.ts addZipToServiceArea). Safe to run twice.
-- ============================================================================
insert into public.markets (name, state, zip_prefixes)
select v.name, v.state, v.zips from (values
  ('Flint & Tri-Cities', 'MI', array['484','485','486','487']),
  ('Lansing', 'MI', array['488','489']),
  ('Kalamazoo & Battle Creek', 'MI', array['490','491']),
  ('Jackson', 'MI', array['492']),
  ('Grand Rapids & West Michigan', 'MI', array['493','494','495']),
  ('Northern Michigan', 'MI', array['496','497']),
  ('Upper Peninsula', 'MI', array['498','499']),
  ('Toledo', 'OH', array['434','435','436'])
) as v(name, state, zips)
where not exists (select 1 from public.markets m where m.name = v.name);
