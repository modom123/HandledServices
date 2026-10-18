-- ============================================================================
-- FILE    : supabase/migrations/20261018024800_pro_resume_photo.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-18_0248 UTC
-- PURPOSE : Pro onboarding: resume and profile photo uploads.
--             • contractors.resume_uploaded_at / photo_uploaded_at — the setup steps (files are
--               contractor_documents rows, kinds 'resume' and 'photo', in the private pro-docs bucket)
--             • contractors.upload_reminders / last_upload_reminder_at — "missing uploads" reminders for
--               pros who are already live (pros still in setup get them in the normal setup reminders)
--           Safe to run twice.
-- ============================================================================
alter table public.contractors
  add column if not exists resume_uploaded_at timestamptz,
  add column if not exists photo_uploaded_at timestamptz,
  add column if not exists upload_reminders int not null default 0,
  add column if not exists last_upload_reminder_at timestamptz;

alter table public.contractor_documents drop constraint if exists contractor_documents_kind_check;
alter table public.contractor_documents add constraint contractor_documents_kind_check
  check (kind in ('w9','coi','license','background','agreement','auto','workers_comp','bond','liquor','passenger_auto','cargo','certification','skills','resume','photo','other'));
