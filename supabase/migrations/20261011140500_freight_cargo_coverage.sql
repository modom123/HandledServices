-- ============================================================================
-- FILE    : supabase/migrations/20261011140500_freight_cargo_coverage.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-11_1405 UTC
-- PURPOSE : Freight & Pallet Delivery (licensed carriers). Carriers upload motor truck cargo insurance, stored as
--           coverage kind 'cargo'. The service itself comes from the catalog sync.
-- ============================================================================
alter table public.contractor_documents drop constraint if exists contractor_documents_kind_check;
alter table public.contractor_documents add constraint contractor_documents_kind_check
  check (kind in ('w9','coi','license','background','agreement','auto','workers_comp','bond','liquor','passenger_auto','cargo','certification','skills','other'));
