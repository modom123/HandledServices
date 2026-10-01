-- ============================================================================
-- FILE    : supabase/migrations/20261001204300_offers_push_notifications.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-01_2043 UTC
-- PURPOSE : Uber-style job offers and phone notifications.
--             • push_tokens     — Expo push tokens per signed-in device (pros and customers)
--             • notifications   — in-app inbox + delivery log of every push/email we send
--             • jobs.instructions — ops/IEBC instructions printed on the pro's work order
--             • job_offers acceptance record — which work-order version the pro agreed to
--             • job_pro(job)    — the customer's safe view of who is covering their job
-- ============================================================================

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  platform text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;
create policy staff_all on public.push_tokens for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy push_tokens_self on public.push_tokens for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create table public.notifications (
  id bigint generated always as identity primary key,
  profile_id uuid references public.profiles(id) on delete cascade,
  email text,
  title text not null,
  body text not null,
  data jsonb not null default '{}',
  channels text[] not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_profile_idx on public.notifications(profile_id, created_at desc);
alter table public.notifications enable row level security;
create policy staff_all on public.notifications for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy notifications_self_read on public.notifications for select to authenticated using (profile_id = auth.uid());
create policy notifications_self_mark on public.notifications for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
alter publication supabase_realtime add table public.notifications;

alter table public.jobs add column instructions text;

alter table public.job_offers
  add column work_order_version text,
  add column terms_accepted_at timestamptz,
  add column accepted_ip text;

-- Who is covering my job? Business name, rating and track record of the assigned pro —
-- only for the customer on that job (customers can't read the contractors table directly).
create or replace function public.job_pro(p_job uuid)
returns table (business_name text, contact_first_name text, rating numeric, jobs_completed int)
language sql stable security definer set search_path = public as $$
  select c.business_name, split_part(c.contact_name, ' ', 1), c.rating, c.jobs_completed
  from public.jobs j join public.contractors c on c.id = j.contractor_id
  where j.id = p_job and (j.customer_id = auth.uid() or public.is_staff())
$$;
grant execute on function public.job_pro(uuid) to authenticated;
