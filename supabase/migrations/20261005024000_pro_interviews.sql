-- ============================================================================
-- FILE    : supabase/migrations/20261005024000_pro_interviews.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-05_0246 UTC
-- PURPOSE : Pro screening interviews (packages/core/src/interview.ts) between application and invite.
--             • pro_interviews — one per interview: AI (the candidate chats from a private link, after an AI
--               disclosure and consent) or a person (in person / phone, scored in the Hub). Transcript, scores
--               with evidence, the computed result, and the staff decision. A person always decides.
--             • contractor_applications.stage adds 'interviewing' and 'interviewed'
-- ============================================================================
create table if not exists public.pro_interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.contractor_applications(id) on delete cascade,
  token text not null unique default substr(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 1, 32),
  mode text not null default 'ai' check (mode in ('ai','human')),
  locale text not null default 'en' check (locale in ('en','es')),
  status text not null default 'invited' check (status in ('invited','in_progress','completed','expired','cancelled','human_requested')),
  plan jsonb not null default '[]'::jsonb,
  transcript jsonb not null default '[]'::jsonb,
  scores jsonb,
  evaluation jsonb,
  result text check (result is null or result in ('advance','follow_up','not_now')),
  average numeric(3,1),
  interviewer text,
  consent_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days',
  decision text check (decision is null or decision in ('invite','follow_up','decline')),
  decided_by text,
  decided_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.pro_interviews enable row level security; -- candidates reach it only through the token API
create policy staff_all on public.pro_interviews for all to authenticated using (public.is_staff()) with check (public.is_staff());
create index if not exists pro_interviews_app_idx on public.pro_interviews (application_id, created_at desc);

alter table public.contractor_applications drop constraint if exists contractor_applications_stage_check;
alter table public.contractor_applications add constraint contractor_applications_stage_check
  check (stage in ('applied','screened','interviewing','interviewed','invited','rejected','withdrawn'));
