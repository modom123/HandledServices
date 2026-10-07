-- ============================================================================
-- FILE    : supabase/migrations/20261001210900_pro_vetting.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-01_2109 UTC
-- PURPOSE : Pro specialties, trade-specific insurance and a richer application.
--             • contractors.specialties — what each pro does best (dispatch prefers specialists)
--             • contractors.coverage    — verified coverage → expiry, e.g.
--                 {"auto":"2027-05-01","bond":"2027-01-31","workers_comp":"exempt"}
--               (general liability stays in insured_until). Offers stop when one lapses.
--             • contractor_applications — specialties, coverages held, equipment, references,
--               links to past work
--             • contractor_documents.kind — commercial auto, workers' comp, bond, liquor
--               liability, certifications and the skills check
-- ============================================================================

alter table public.contractors
  add column specialties text[] not null default '{}',
  add column coverage jsonb not null default '{}';

alter table public.contractor_applications
  add column specialties text[] not null default '{}',
  add column coverages_held text[] not null default '{}',
  add column equipment text,
  add column references_text text,
  add column work_links text;

alter table public.contractor_documents drop constraint if exists contractor_documents_kind_check;
alter table public.contractor_documents add constraint contractor_documents_kind_check
  check (kind in ('w9','coi','license','background','agreement','auto','workers_comp','bond','liquor','certification','skills','other'));
