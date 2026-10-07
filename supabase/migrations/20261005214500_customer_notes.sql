-- ============================================================================
-- FILE    : supabase/migrations/20261005214500_customer_notes.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-05_2146 UTC
-- PURPOSE : Customer notes — the same permanent, append-only history now covers homeowner / walk-in customers.
--           A customer is keyed by their email: subject_id = md5(lower(trim(email)))::uuid, so every booking
--           under that email shares one history (the app computes the same id).
-- ============================================================================
alter table public.account_notes drop constraint if exists account_notes_subject_type_check;
alter table public.account_notes add constraint account_notes_subject_type_check
  check (subject_type in ('biz_lead','business_account','talent_client','customer'));

create or replace function public.customer_subject_id(email text) returns uuid language sql immutable as $$
  select md5(lower(trim(email)))::uuid
$$;
