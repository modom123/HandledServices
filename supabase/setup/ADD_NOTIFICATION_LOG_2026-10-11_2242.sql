-- ============================================================================
-- FILE    : supabase/setup/ADD_NOTIFICATION_LOG_2026-10-11_2242.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-10-11_2242 UTC
-- PURPOSE : For the EXISTING Supabase project: the notification log behind Hub → Dispatch ("last contacted") and the job
--           page's "Notifications sent" list. Same as migration 20261011224200_notification_log.sql.
--           Run once in Supabase -> SQL Editor. Safe to run twice. Until it runs, messages still send; they just aren't logged.
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
