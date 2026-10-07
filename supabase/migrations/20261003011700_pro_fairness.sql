-- ============================================================================
-- FILE    : supabase/migrations/20261003011700_pro_fairness.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-03_0117 UTC
-- PURPOSE : Make the system do what the Independent Contractor Agreement promises:
--             • pro_deductions        — a refund or lost chargeback charged to a pro is only a
--                                        PROPOSAL: written notice, 3 business days to respond, a
--                                        person decides; applied amounts never exceed half of a
--                                        weekly payout and never touch tips
--             • pro_standing_events   — late cancels, no-shows, warnings, suspensions,
--                                        deactivations, appeals and reinstatements, with reasons
--             • contractors.standing  — good / warned / suspended / deactivated (+ dates)
-- ============================================================================

create table if not exists public.pro_deductions (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  amount numeric(10,2) not null check (amount > 0),
  reason text not null,
  source text not null check (source in ('refund','chargeback')),
  status text not null default 'proposed' check (status in ('proposed','upheld','waived')),
  respond_by timestamptz not null,
  pro_response text,
  responded_at timestamptz,
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);
alter table public.pro_deductions enable row level security;
create index if not exists pro_deductions_open_idx on public.pro_deductions (status, respond_by);
create index if not exists pro_deductions_pro_idx on public.pro_deductions (contractor_id, created_at desc);
create policy "pro reads own deductions" on public.pro_deductions for select using (
  contractor_id in (select id from public.contractors where profile_id = auth.uid())
);

create table if not exists public.pro_standing_events (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  kind text not null check (kind in ('late_cancel','no_show','warning','suspension','deactivation','appeal','appeal_upheld','reinstated','note')),
  job_id uuid references public.jobs(id) on delete set null,
  note text,
  actor text,
  created_at timestamptz not null default now()
);
alter table public.pro_standing_events enable row level security;
create index if not exists pro_standing_pro_idx on public.pro_standing_events (contractor_id, created_at desc);
create policy "pro reads own standing" on public.pro_standing_events for select using (
  contractor_id in (select id from public.contractors where profile_id = auth.uid())
);

alter table public.contractors
  add column if not exists standing text not null default 'good' check (standing in ('good','warned','suspended','deactivated')),
  add column if not exists standing_reason text,
  add column if not exists warned_at timestamptz,
  add column if not exists improve_by date,
  add column if not exists appeal_by date,
  add column if not exists appeal_decide_by date,
  add column if not exists background_recheck_due date;

-- Payout rows can be held for a deduction decision; a deduction's applied piece is recorded as a clawback row.
alter table public.payouts add column if not exists deduction_id uuid references public.pro_deductions(id) on delete set null;
