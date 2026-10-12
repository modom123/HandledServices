-- ============================================================================
-- FILE    : supabase/migrations/20261012012100_id_numbers.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-12_0121 UTC
-- PURPOSE : ID numbers for everyone, alongside job refs (H-1001…):
--             customers  C-10001…  customer_ids, one per email — guests get one on their first booking, accounts
--                                  on sign-up; the account (profile) is linked when it exists
--             clients    B-501…    business_accounts.client_no
--             pros       P-1001…   contractors.pro_no
--             staff      S-101…    profiles.staff_no, given when someone becomes admin or dispatcher (kept after)
--           Existing records are numbered oldest first. Safe to run twice.
-- ============================================================================

create sequence if not exists public.customer_no_seq start 10001;
create sequence if not exists public.client_no_seq start 501;
create sequence if not exists public.pro_no_seq start 1001;
create sequence if not exists public.staff_no_seq start 101;

-- customers ──────────────────────────────────────────────────────────────────
create table if not exists public.customer_ids (
  email text primary key check (email = lower(email)),
  customer_no text not null unique default ('C-' || nextval('public.customer_no_seq')::text),
  profile_id uuid unique references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.customer_ids enable row level security;
drop policy if exists staff_all on public.customer_ids;
create policy staff_all on public.customer_ids for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists own_read on public.customer_ids;
create policy own_read on public.customer_ids for select to authenticated using (profile_id = auth.uid());

-- backfill: every email that has booked or has an account, oldest first
insert into public.customer_ids (email, created_at)
select email, min(at) from (
  select lower(trim(contact_email)) as email, created_at as at from public.jobs where contact_email is not null and contact_email like '%@%'
  union all
  select lower(trim(email)), created_at from public.profiles where email is not null and email like '%@%'
) x where not exists (select 1 from public.customer_ids c where c.email = x.email)
group by email order by min(at)
on conflict (email) do nothing;
update public.customer_ids c set profile_id = p.id
  from public.profiles p where c.profile_id is null and lower(trim(p.email)) = c.email
  and not exists (select 1 from public.customer_ids o where o.profile_id = p.id);

create or replace function public.ensure_customer_id(p_email text, p_profile uuid default null) returns text
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email)); n text;
begin
  if e is null or e not like '%@%' then return null; end if;
  -- already numbered: link the account if it isn't yet (no new number used)
  select customer_no into n from public.customer_ids where email = e;
  if n is not null then
    if p_profile is not null then
      update public.customer_ids set profile_id = p_profile where email = e and profile_id is null
        and not exists (select 1 from public.customer_ids o where o.profile_id = p_profile);
    end if;
    return n;
  end if;
  insert into public.customer_ids (email, profile_id) values (e, p_profile)
    on conflict (email) do update set profile_id = coalesce(public.customer_ids.profile_id, excluded.profile_id)
    returning customer_no into n;
  return n;
exception when unique_violation then
  -- this profile is already linked to another email: keep that link
  insert into public.customer_ids (email) values (e) on conflict (email) do nothing;
  select customer_no into n from public.customer_ids where email = e;
  return n;
end $$;

create or replace function public.jobs_customer_id() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.ensure_customer_id(new.contact_email, new.customer_id);
  return new;
end $$;
drop trigger if exists jobs_customer_id on public.jobs;
create trigger jobs_customer_id after insert on public.jobs for each row execute function public.jobs_customer_id();

-- staff ──────────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists staff_no text unique;
with s as (select id, row_number() over (order by created_at) as r from public.profiles where role in ('admin','dispatcher') and staff_no is null)
update public.profiles p set staff_no = 'S-' || (100 + s.r + coalesce((select max(substr(staff_no, 3)::int) - 100 from public.profiles where staff_no ~ '^S-\d+$'), 0))::text
  from s where p.id = s.id;
do $$ begin
  perform setval('public.staff_no_seq', greatest(101, coalesce((select max(substr(staff_no, 3)::int) + 1 from public.profiles where staff_no ~ '^S-\d+$'), 101)), false);
end $$;

create or replace function public.profiles_ids() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role in ('admin','dispatcher') and new.staff_no is null then
    new.staff_no := 'S-' || nextval('public.staff_no_seq')::text;
  end if;
  return new;
end $$;
drop trigger if exists profiles_ids on public.profiles;
create trigger profiles_ids before insert or update of role on public.profiles for each row execute function public.profiles_ids();

create or replace function public.profiles_customer_id() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.ensure_customer_id(new.email, new.id);
  return new;
end $$;
drop trigger if exists profiles_customer_id on public.profiles;
create trigger profiles_customer_id after insert on public.profiles for each row execute function public.profiles_customer_id();

-- pros ───────────────────────────────────────────────────────────────────────
alter table public.contractors add column if not exists pro_no text unique;
with s as (select id, row_number() over (order by created_at) as r from public.contractors where pro_no is null)
update public.contractors c set pro_no = 'P-' || (1000 + s.r + coalesce((select max(substr(pro_no, 3)::int) - 1000 from public.contractors where pro_no ~ '^P-\d+$'), 0))::text
  from s where c.id = s.id;
do $$ begin
  perform setval('public.pro_no_seq', greatest(1001, coalesce((select max(substr(pro_no, 3)::int) + 1 from public.contractors where pro_no ~ '^P-\d+$'), 1001)), false);
end $$;
alter table public.contractors alter column pro_no set default ('P-' || nextval('public.pro_no_seq')::text);

-- business clients ───────────────────────────────────────────────────────────
alter table public.business_accounts add column if not exists client_no text unique;
with s as (select id, row_number() over (order by created_at) as r from public.business_accounts where client_no is null)
update public.business_accounts b set client_no = 'B-' || (500 + s.r + coalesce((select max(substr(client_no, 3)::int) - 500 from public.business_accounts where client_no ~ '^B-\d+$'), 0))::text
  from s where b.id = s.id;
do $$ begin
  perform setval('public.client_no_seq', greatest(501, coalesce((select max(substr(client_no, 3)::int) + 1 from public.business_accounts where client_no ~ '^B-\d+$'), 501)), false);
end $$;
alter table public.business_accounts alter column client_no set default ('B-' || nextval('public.client_no_seq')::text);
