-- ============================================================================
-- FILE    : supabase/migrations/20261027230000_pro_office_team.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-27_2300 UTC
-- PURPOSE : Office manager logins for pro companies (e.g. the office at "Atkins & Sons").
--             • contractor_members — people the owner invites by email to run the company's Handled account:
--                 accept offers, schedule, pick crew, message customers. They sign in with their own email and
--                 act for the company; money, tax, contracts, documents and the team stay with the owner.
--             • my_contractor_id() — the owner's company, else the company an active office member works for,
--                 so every "pro reads own …" policy built on it covers office members too
--             • the policies that looked up contractors.profile_id directly now use my_contractor_id()
--           Safe to run twice.
-- ============================================================================
create table if not exists public.contractor_members (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  full_name text not null check (length(full_name) between 2 and 120),
  phone text,
  role text not null default 'office' check (role in ('office')),
  profile_id uuid references public.profiles(id) on delete set null,
  invited_by text,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  last_seen_at timestamptz,
  active boolean not null default true,
  removed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.contractor_members enable row level security;
-- one company per office login (an email can't run two pro companies' accounts)
create unique index if not exists contractor_members_email_active on public.contractor_members (lower(email)) where active;
create index if not exists contractor_members_pro_idx on public.contractor_members (contractor_id) where active;
create index if not exists contractor_members_profile_idx on public.contractor_members (profile_id) where active;

create or replace function public.my_contractor_id() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select id from public.contractors where profile_id = auth.uid()),
    (select contractor_id from public.contractor_members where profile_id = auth.uid() and active order by accepted_at limit 1)
  )
$$;

drop policy if exists "team reads own company" on public.contractor_members;
create policy "team reads own company" on public.contractor_members for select to authenticated using (contractor_id = public.my_contractor_id());
drop policy if exists staff_all on public.contractor_members;
create policy staff_all on public.contractor_members for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- policies that matched the owner's profile directly → the company of whoever is signed in
drop policy if exists contractor_self on public.contractors;
create policy contractor_self on public.contractors for select to authenticated using (id = public.my_contractor_id());
drop policy if exists "pro reads own crew" on public.crew_members;
create policy "pro reads own crew" on public.crew_members for select using (contractor_id = public.my_contractor_id());
drop policy if exists "pro reads own deductions" on public.pro_deductions;
create policy "pro reads own deductions" on public.pro_deductions for select using (contractor_id = public.my_contractor_id());
drop policy if exists "pro reads own standing" on public.pro_standing_events;
create policy "pro reads own standing" on public.pro_standing_events for select using (contractor_id = public.my_contractor_id());
-- contracts stay with the person who signed them, plus the owner's company records
drop policy if exists "own contracts" on public.contract_acceptances;
create policy "own contracts" on public.contract_acceptances for select using (
  profile_id = auth.uid()
  or contractor_id in (select id from public.contractors where profile_id = auth.uid())
);
