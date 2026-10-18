-- ============================================================================
-- FILE    : supabase/setup/ADD_PRO_RESUME_PHOTO_2026-10-18_0248.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-10-18_0248 UTC
-- PURPOSE : For the EXISTING Supabase project: resume and profile photo steps in pro onboarding, and the
--           "missing uploads" reminders. Same as migration 20261018024800_pro_resume_photo.sql.
--           Run once in Supabase -> SQL Editor. Safe to run twice. Run it BEFORE deploying the code that uses it.
-- ============================================================================
alter table public.contractors
  add column if not exists resume_uploaded_at timestamptz,
  add column if not exists photo_uploaded_at timestamptz,
  add column if not exists upload_reminders int not null default 0,
  add column if not exists last_upload_reminder_at timestamptz;

alter table public.contractor_documents drop constraint if exists contractor_documents_kind_check;
alter table public.contractor_documents add constraint contractor_documents_kind_check
  check (kind in ('w9','coi','license','background','agreement','auto','workers_comp','bond','liquor','passenger_auto','cargo','certification','skills','resume','photo','other'));
