-- ============================================================================
-- FILE    : supabase/migrations/20261106023400_ny_nj_las_vegas_service_areas.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-11-06_0234 UTC
-- PURPOSE : New service areas, with area price levels (markets.price_multiplier → lib/launch regionFactor):
--             New York  — New York City 1.35 (Staten Island 1.30), Westchester & Rockland and Long Island 1.30,
--                         Hudson Valley 1.15, Capital Region & North Country 1.05, Central / Western NY 1.00
--             New Jersey — North Jersey 1.20, Central Jersey & the Shore 1.15, South Jersey 1.10
--             Las Vegas area (Nevada) — Las Vegas Valley (incl. Henderson, North Las Vegas, Boulder City) and
--                         Southern Nevada (Pahrump, Mesquite, Laughlin) 1.10. Reno / northern Nevada not served yet.
--           No launch list → every service is bookable, but a booking still needs a vetted pro who covers the ZIP
--           (no pro → waitlist, nothing charged). The pro's pay follows the price. Safe to run twice.
-- ============================================================================
insert into public.markets (name, state, zip_prefixes, price_multiplier)
select v.name, v.state, v.zips, v.mult from (values
  -- New York City
  ('Manhattan', 'NY', array['100','101','102'], 1.35),
  ('Brooklyn', 'NY', array['112'], 1.35),
  ('Queens', 'NY', array['110','111','113','114','116'], 1.35),
  ('The Bronx', 'NY', array['104'], 1.35),
  ('Staten Island', 'NY', array['103'], 1.30),
  -- New York suburbs
  ('Westchester & Rockland', 'NY', array['105','106','107','108','109'], 1.30),
  ('Long Island', 'NY', array['115','117','118','119'], 1.30),
  -- Upstate New York
  ('Hudson Valley', 'NY', array['124','125','126','127'], 1.15),
  ('Capital Region & North Country', 'NY', array['120','121','122','123','128','129'], 1.05),
  ('Central NY & Southern Tier', 'NY', array['130','131','132','133','134','135','136','137','138','139','148','149'], 1.00),
  ('Western NY (Buffalo & Rochester)', 'NY', array['140','141','142','143','144','145','146','147'], 1.00),
  -- New Jersey
  ('North Jersey', 'NJ', array['070','071','072','073','074','075','076','078','079'], 1.20),
  ('Central Jersey & the Shore', 'NJ', array['077','085','086','087','088','089'], 1.15),
  ('South Jersey', 'NJ', array['080','081','082','083','084'], 1.10),
  -- Las Vegas area (Nevada). 890xx is split by ZIP so the two areas never overlap; any other 889–891 ZIP joins
  -- "Las Vegas area — new areas" on its first booking.
  ('Las Vegas Valley', 'NV', array['889','891',
     '89002','89005','89006','89009','89011','89012','89014','89015','89016','89044','89052','89053','89074','89077',
     '89030','89031','89032','89033','89036','89081','89084','89085','89086','89087','89004'], 1.10),
  ('Southern Nevada (Pahrump, Mesquite, Laughlin)', 'NV', array[
     '89041','89048','89060','89061','89024','89027','89028','89029','89018','89019','89021','89025','89039','89040','89046'], 1.10)
) as v(name, state, zips, mult)
where not exists (select 1 from public.markets m where m.name = v.name);

-- keep the price levels right if an area was added earlier without them
update public.markets set price_multiplier = 1.35 where state = 'NY' and name in ('Manhattan','Brooklyn','Queens','The Bronx');
update public.markets set price_multiplier = 1.30 where state = 'NY' and name in ('Staten Island','Westchester & Rockland','Long Island');
update public.markets set price_multiplier = 1.15 where state = 'NY' and name = 'Hudson Valley';
update public.markets set price_multiplier = 1.05 where state = 'NY' and name = 'Capital Region & North Country';
update public.markets set price_multiplier = 1.00 where state = 'NY' and name in ('Central NY & Southern Tier','Western NY (Buffalo & Rochester)');
update public.markets set price_multiplier = 1.20 where state = 'NJ' and name = 'North Jersey';
update public.markets set price_multiplier = 1.15 where state = 'NJ' and name = 'Central Jersey & the Shore';
update public.markets set price_multiplier = 1.10 where state = 'NJ' and name = 'South Jersey';
update public.markets set price_multiplier = 1.10 where state = 'NV';
