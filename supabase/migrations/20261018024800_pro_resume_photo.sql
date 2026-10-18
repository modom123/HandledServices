-- ============================================================================
-- FILE    : supabase/migrations/20261018024800_pro_resume_photo.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-18_0248 UTC
-- PURPOSE : Pro onboarding: resume and profile photo uploads.
--             • contractors.resume_uploaded_at / photo_uploaded_at — the setup steps (files are
--               contractor_documents rows, kinds 'resume' and 'photo', in the private pro-docs bucket)
--             • contractors.upload_reminders / last_upload_reminder_at — "missing uploads" reminders for
--               pros who are already live (pros still in setup get them in the normal setup reminders)
-- UPDATED : 2026-10-18_0415 UTC — pros that are businesses: LLCs taxed as S/C corporations on the W-9 (no 1099-NEC);
--           contractors.agreement_signed_for / agreement_signer_title and contract_acceptances.on_behalf_of /
--           signer_title (signing the pro agreement for a business).
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

-- 2026-10-18_0415: pros that are businesses — W-9 classification for LLCs taxed as S/C corporations (no 1099-NEC),
-- and who signed the agreement for which business (and their title).
alter table public.contractors drop constraint if exists contractors_entity_type_check;
alter table public.contractors add constraint contractors_entity_type_check
  check (entity_type in ('individual','sole_prop','llc','llc_s_corp','llc_c_corp','s_corp','c_corp','partnership'));
alter table public.contractors
  add column if not exists agreement_signed_for text,
  add column if not exists agreement_signer_title text;
alter table public.contract_acceptances
  add column if not exists on_behalf_of text,
  add column if not exists signer_title text;
