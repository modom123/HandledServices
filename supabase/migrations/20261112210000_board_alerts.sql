-- ============================================================================
-- FILE    : supabase/migrations/20261112210000_board_alerts.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-11-12_2100 UTC
-- PURPOSE : Job board alerts for pros (lib/board.ts alertBoardJob / boardDigest):
--             contractors.board_alerts — 'all'    (default) a text/push the moment a name-your-price post or top-pay
--                                                 job near them lands on the board, plus a daily summary of other new jobs
--                                        'digest' the daily summary only
--                                        'off'    no board alerts (direct job offers still come as usual)
--           Until this is run, every pro gets 'all'. Safe to run twice.
-- ============================================================================
alter table public.contractors add column if not exists board_alerts text not null default 'all';
alter table public.contractors drop constraint if exists contractors_board_alerts_check;
alter table public.contractors add constraint contractors_board_alerts_check check (board_alerts in ('all','digest','off'));
