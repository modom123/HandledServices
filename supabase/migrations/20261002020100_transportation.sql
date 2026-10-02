-- ============================================================================
-- FILE    : supabase/migrations/20261002020100_transportation.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-02_0201 UTC
-- PURPOSE : Transportation (private driver, airport transfer, limousine, party bus, charter bus,
--           event shuttle) booked with licensed operator companies. Operators upload passenger-
--           carrier auto liability ($1.5M up to 15 seats / $5M for 16+), stored as coverage
--           kind 'passenger_auto'. The services themselves come from the catalog sync / seed.
-- ============================================================================
alter table public.contractor_documents drop constraint if exists contractor_documents_kind_check;
alter table public.contractor_documents add constraint contractor_documents_kind_check
  check (kind in ('w9','coi','license','background','agreement','auto','workers_comp','bond','liquor','passenger_auto','certification','skills','other'));
