-- ============================================================================
-- FILE    : supabase/migrations/20261007060000_washington_service_areas.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-07_1700 UTC
-- PURPOSE : Washington service areas (Handled serves Michigan and Washington). No launch list → every service bookable.
--             Seattle & Eastside        980, 981   (Seattle, Bellevue, Redmond, Kirkland, Renton, Kent, Auburn, Issaquah)
--             Everett & North Sound     982        (Everett, Lynnwood, Marysville, Mount Vernon, Bellingham)
--             Tacoma & South Sound      983, 984   (Tacoma, Puyallup, Lakewood, Federal Way area, Bremerton / Kitsap)
--             Olympia & Southwest WA    985, 986   (Olympia, Lacey, Tumwater, Centralia, Vancouver WA)
--             Central Washington        988, 989   (Wenatchee, Ellensburg, Yakima)
--             Spokane & Eastern WA      990–994    (Spokane, Spokane Valley, Tri-Cities, Walla Walla, Pullman)
--           A booking still needs a vetted pro who covers the ZIP (no pro → waitlist, nothing charged). Safe to run twice.
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
