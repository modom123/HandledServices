-- ============================================================================
-- FILE    : supabase/migrations/20261012152500_talent_flat_fee.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-12_1525 UTC
-- PURPOSE : Handled Talent — flat fee per hire: a third search type ("flat") with its fee per hire (flat_fee).
--           Flat searches keep fee_pct and recruiter_pct at 0; the recruiter gets 80% of the flat fee. Safe to run twice.
-- ============================================================================
alter table public.talent_searches add column if not exists flat_fee numeric;
alter table public.talent_searches drop constraint if exists talent_searches_type_check;
alter table public.talent_searches add constraint talent_searches_type_check check (type in ('contingency','retained','flat'));
alter table public.talent_searches drop constraint if exists talent_searches_fee_pct_check;
alter table public.talent_searches add constraint talent_searches_fee_pct_check check (fee_pct >= 0 and fee_pct <= 50 and (type = 'flat' or fee_pct > 0));
alter table public.talent_searches drop constraint if exists talent_searches_flat_fee_check;
alter table public.talent_searches add constraint talent_searches_flat_fee_check check (type <> 'flat' or coalesce(flat_fee, 0) > 0);
