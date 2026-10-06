-- ============================================================================
-- FILE    : supabase/migrations/20261006212000_cancellation_tracking.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-06_2120 UTC
-- PURPOSE : Track every cancellation, not just the ones that count against a pro:
--             pro_standing_events.kind adds 'free_cancel' (handed back 24h+ ahead - recorded, never counted).
--           Hub -> Cancellations & coverage and the pro's own record read these.
-- ============================================================================
alter table public.pro_standing_events drop constraint if exists pro_standing_events_kind_check;
alter table public.pro_standing_events add constraint pro_standing_events_kind_check
  check (kind in ('late_cancel','short_notice_cancel','free_cancel','excused_cancel','no_show','warning','suspension','deactivation','appeal','appeal_upheld','reinstated','note'));
create index if not exists pro_standing_kind_idx on public.pro_standing_events (kind, created_at desc);
