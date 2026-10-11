-- ============================================================================
-- FILE    : supabase/migrations/20261011224200_notification_log.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-11_2242 UTC
-- PURPOSE : Notification log — every email, text and push the system sends (lib/notification-log): channel, recipient,
--           subject, a short preview (links and sign-in codes removed), sent / failed / skipped and why, and the job it's
--           about. Shown on the Hub job page and as "last contacted" on Hub → Dispatch. Kept 180 days.
-- ============================================================================
create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email','sms','push')),
  recipient text not null,
  subject text,
  preview text,
  status text not null check (status in ('sent','failed','skipped')),
  error text,
  job_id uuid references public.jobs(id) on delete set null,
  job_ref text,
  created_at timestamptz not null default now()
);
create index if not exists notification_log_job_ref_idx on public.notification_log (job_ref, created_at desc);
create index if not exists notification_log_job_id_idx on public.notification_log (job_id, created_at desc);
create index if not exists notification_log_created_idx on public.notification_log (created_at desc);

-- staff only (customers and pros never read it); the server writes with the service role
alter table public.notification_log enable row level security;
drop policy if exists staff_read on public.notification_log;
create policy staff_read on public.notification_log for select to authenticated using (public.is_staff());
