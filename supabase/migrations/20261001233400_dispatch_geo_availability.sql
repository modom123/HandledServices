-- ============================================================================
-- FILE    : supabase/migrations/20261001233400_dispatch_geo_availability.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-01_2334 UTC
-- PURPOSE : Dispatch by availability, quality and location.
--             • contractors: base ZIP + coordinates, driving radius, working days/windows,
--               time off — used by dispatch and the customer booking calendar
--             • jobs: coordinates (ZIP centroid) for distance to each pro
--             • zip_geo: cached ZIP centroids (looked up once, reused)
--             • jobs.scope_extra: extra work the pro found on site (change orders) — the
--               underbid signal Finance reports per service
-- ============================================================================

alter table public.contractors
  add column base_zip text check (base_zip ~ '^[0-9]{5}$'),
  add column base_lat double precision,
  add column base_lng double precision,
  add column service_radius_mi int not null default 25 check (service_radius_mi between 1 and 150),
  add column availability jsonb,
  add column time_off date[] not null default '{}';

alter table public.jobs
  add column lat double precision,
  add column lng double precision,
  add column scope_extra numeric(10,2) not null default 0;

create table public.zip_geo (
  zip text primary key check (zip ~ '^[0-9]{5}$'),
  lat double precision not null,
  lng double precision not null,
  city text,
  state text,
  fetched_at timestamptz not null default now()
);
alter table public.zip_geo enable row level security;
create policy zip_geo_read on public.zip_geo for select to anon, authenticated using (true);
