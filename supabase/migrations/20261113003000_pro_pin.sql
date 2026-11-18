-- ============================================================================
-- FILE    : supabase/migrations/20261113003000_pro_pin.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-11-13_0030 UTC
-- PURPOSE : The Pro PIN (apps/web/lib/pro-pin.ts): an extra lock on an accepted job's street address, customer contact
--           and entry details. The PIN is stored hashed (scrypt + salt), never in plain text. 5 wrong tries lock it
--           for 15 minutes. Until this is run the lock is off. Safe to run twice.
-- ============================================================================
alter table public.contractors add column if not exists pin_hash text;
alter table public.contractors add column if not exists pin_set_at timestamptz;
alter table public.contractors add column if not exists pin_failed integer not null default 0;
alter table public.contractors add column if not exists pin_locked_until timestamptz;
