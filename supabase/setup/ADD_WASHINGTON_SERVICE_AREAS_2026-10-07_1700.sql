-- ============================================================================
-- FILE    : supabase/setup/ADD_WASHINGTON_SERVICE_AREAS_2026-10-07_1700.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-10-07_1700 UTC
-- PURPOSE : For the EXISTING Supabase project: Washington service areas — Seattle & Eastside, Everett & North Sound,
--           Tacoma & South Sound, Olympia & Southwest WA, Central Washington, Spokane & Eastern WA. Also turns off the
--           Toledo, OH area if an earlier script added it (Handled serves Michigan and Washington).
--           Same as migration 20261007060000_washington_service_areas.sql. Run once in Supabase -> SQL Editor. Safe to run twice.
-- ============================================================================
insert into public.markets (name, state, zip_prefixes)
select v.name, v.state, v.zips from (values
  ('Seattle & Eastside', 'WA', array['980','981']),
  ('Everett & North Sound', 'WA', array['982']),
  ('Tacoma & South Sound', 'WA', array['983','984']),
  ('Olympia & Southwest WA', 'WA', array['985','986']),
  ('Central Washington', 'WA', array['988','989']),
  ('Spokane & Eastern WA', 'WA', array['990','991','992','993','994'])
) as v(name, state, zips)
where not exists (select 1 from public.markets m where m.name = v.name);

update public.markets set active = false where name = 'Toledo' and state = 'OH';
