-- ============================================================================
-- FILE    : supabase/migrations/20261117235000_walkthroughs.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-11-17_2350 UTC
-- PURPOSE : Free walkthroughs businesses book themselves (/walkthrough, core walkthrough.ts).
--             walkthroughs          — one booking: on-site walkthrough or a short call, who, where, what they need,
--                                     the sales lead it came from, a private token for their manage link
--             walkthrough_settings  — hours, days, slot length, bookings per slot, lead time, how far ahead
--           Server-only (service role); admins can read and change them in the Hub. Safe to run twice.
-- ============================================================================
create table if not exists public.walkthroughs (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  kind text not null default 'onsite' check (kind in ('onsite','call')),
  starts_at timestamptz not null,
  minutes int not null default 45,
  status text not null default 'booked' check (status in ('booked','done','no_show','cancelled')),
  name text not null,
  company text not null,
  email text not null,
  phone text,
  address text,
  city text,
  state text,
  zip text,
  segment text,
  landing text,
  needs text,
  properties int,
  biz_lead_id uuid references public.biz_leads(id) on delete set null,
  attribution jsonb,
  staff_notes text,
  assigned_to text,
  reminded_at timestamptz,
  followed_up_at timestamptz,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists walkthroughs_starts_idx on public.walkthroughs (starts_at) where status = 'booked';
create index if not exists walkthroughs_lead_idx on public.walkthroughs (biz_lead_id);
alter table public.walkthroughs enable row level security;

create table if not exists public.walkthrough_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default true,
  days int[] not null default '{1,2,3,4,5}',
  start_min int not null default 540 check (start_min between 0 and 1439),
  end_min int not null default 1020 check (end_min between 1 and 1440),
  slot_minutes int not null default 30 check (slot_minutes between 10 and 240),
  per_slot int not null default 1 check (per_slot between 1 and 20),
  lead_hours int not null default 18 check (lead_hours between 0 and 168),
  horizon_days int not null default 14 check (horizon_days between 1 and 60),
  time_zone text not null default 'America/Detroit',
  notify_emails text,
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.walkthrough_settings (id) values (1) on conflict (id) do nothing;
alter table public.walkthrough_settings enable row level security;

do $$ begin
  if exists (select 1 from pg_proc where proname = 'is_admin') then
    execute 'drop policy if exists admin_all on public.walkthroughs';
    execute 'create policy admin_all on public.walkthroughs for all to authenticated using (public.is_admin()) with check (public.is_admin())';
    execute 'drop policy if exists admin_all on public.walkthrough_settings';
    execute 'create policy admin_all on public.walkthrough_settings for all to authenticated using (public.is_admin()) with check (public.is_admin())';
  end if;
end $$;
