-- ============================================================================
-- FILE    : supabase/setup/ADD_RECRUITING_INTAKE_2026-10-23_1100.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-23_1100 UTC
-- PURPOSE : ONE paste for the existing Supabase project (Supabase -> SQL Editor -> New query -> paste -> Run).
--           Candidates from outside the /pros form — Indeed Apply, CSV imports, staff adding someone by hand:
--             • contractor_applications.external_source / external_id — the ATS and its application id
--               (unique together, so a re-delivered Indeed application is never added twice)
--             • external_job  — the job they applied to (id, title, location, jobMeta, url)
--             • screener      — screener-question answers as sent
--             • resume_path   — résumé file in the private pro-docs bucket (applications/<id>/…)
--             • added_by      — the staff member who added or imported them
--           Safe to run twice.
-- ============================================================================
alter table public.contractor_applications
  add column if not exists external_source text,
  add column if not exists external_id text,
  add column if not exists external_job jsonb,
  add column if not exists screener jsonb,
  add column if not exists resume_path text,
  add column if not exists added_by text;

create unique index if not exists contractor_applications_external_uidx
  on public.contractor_applications (external_source, external_id) where external_id is not null;
