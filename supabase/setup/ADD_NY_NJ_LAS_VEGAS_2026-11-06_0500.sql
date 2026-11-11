-- ============================================================================
-- FILE    : supabase/setup/ADD_NY_NJ_LAS_VEGAS_2026-11-06_0500.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-11-06_0500 UTC
-- PURPOSE : ONE paste: open New York, New Jersey and Las Vegas for booking (migration 20261106050000_ny_nj_nv_service_areas).
--           Supabase -> SQL Editor -> New query -> paste this whole file -> Run. Safe to run twice.
--           Check the price levels below before running — they are starting values.
-- ============================================================================

-- ============================================================================
-- FILE    : supabase/migrations/20261106050000_ny_nj_nv_service_areas.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-11-06_0500 UTC
-- PURPOSE : New service areas: New York, New Jersey and Las Vegas (Handled now serves MI, NY, NJ, NV, WA).
--           No launch list → every service is bookable; a booking still needs a vetted pro who covers the ZIP
--           (no pro → waitlist, nothing charged). Area price levels (markets.price_multiplier; Michigan = 1.00,
--           Seattle area = 1.25). STARTING VALUES — change them here or in Hub → Cities as you learn local prices:
--             New York City            100–104, 110–114, 116   +35%  → 1.35
--             NYC suburbs              105–109, 115, 117–119   +30%  → 1.30  (Westchester, Rockland, Long Island)
--             North Jersey             070–076                 +25%  → 1.25
--             Central & South Jersey   077–089                 +15%  → 1.15
--             Las Vegas Valley         889–891                  +5%  → 1.05
--           Upstate New York and the rest of Nevada join a "<state> — new areas" market on their first booking.
--           Safe to run twice.
-- ============================================================================
insert into public.markets (name, state, zip_prefixes, price_multiplier)
select v.name, v.state, v.zips, v.mult from (values
  ('New York City', 'NY', array['100','101','102','103','104','110','111','112','113','114','116'], 1.35),
  ('NYC suburbs', 'NY', array['105','106','107','108','109','115','117','118','119'], 1.30),
  ('North Jersey', 'NJ', array['070','071','072','073','074','075','076'], 1.25),
  ('Central & South Jersey', 'NJ', array['077','078','079','080','081','082','083','084','085','086','087','088','089'], 1.15),
  ('Las Vegas Valley', 'NV', array['889','890','891'], 1.05)
) as v(name, state, zips, mult)
where not exists (select 1 from public.markets m where m.name = v.name);
