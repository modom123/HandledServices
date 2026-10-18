-- ============================================================================
-- FILE    : supabase/setup/ADD_PRO_RESUME_PHOTO_2026-10-18_0248.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-10-18_0248 UTC
-- PURPOSE : For the EXISTING Supabase project: resume and profile photo steps in pro onboarding, and the
--           "missing uploads" reminders. Same as migration 20261018024800_pro_resume_photo.sql.
-- UPDATED : 2026-10-18_0415 UTC — also: LLCs taxed as S/C corporations on the W-9, and signing the pro agreement for a
--           business (name + title). Already ran the earlier version? Run this one again — it's safe.
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
