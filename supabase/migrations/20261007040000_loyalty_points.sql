-- ============================================================================
-- FILE    : supabase/migrations/20261007040000_loyalty_points.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-07_0530 UTC
-- PURPOSE : Handled Points — loyalty points for every customer account (rules: packages/core/src/loyalty.ts).
--             • loyalty_settings — earn rate, point value, pending days, expiry, bonuses (one row)
--             • loyalty_ledger   — every point movement for a person (profile_id / email) or a business account:
--                                  earn (per job, pending → available), bonus, redeem (negative), adjust, expire
--             • redeem_loyalty() — turns points into a credit code in one step (no double spending)
--           People read their own points; business members read their account's; writes go through the API.
-- ============================================================================
create table if not exists public.loyalty_settings (
  id int primary key default 1 check (id = 1),
  settings jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.loyalty_settings enable row level security;
drop policy if exists staff_all on public.loyalty_settings;
create policy staff_all on public.loyalty_settings for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  email text,
  business_account_id uuid references public.business_accounts(id) on delete cascade,
  kind text not null check (kind in ('earn','bonus','redeem','adjust','expire')),
  points int not null,
  status text not null default 'available' check (status in ('pending','available','void')),
  job_id uuid references public.jobs(id) on delete set null,
  ref text unique,                -- one per event: earn:<job>, first:<account>, review:<job>
  code text,                      -- credit code a redemption created
  available_at timestamptz,
  detail jsonb,
  note text,
  created_by text not null default 'system',
  created_at timestamptz not null default now(),
  check (profile_id is not null or email is not null or business_account_id is not null)
);
create index if not exists loyalty_ledger_profile_idx on public.loyalty_ledger (profile_id, created_at desc) where business_account_id is null;
create index if not exists loyalty_ledger_email_idx on public.loyalty_ledger (lower(email)) where business_account_id is null;
create index if not exists loyalty_ledger_business_idx on public.loyalty_ledger (business_account_id, created_at desc) where business_account_id is not null;
create index if not exists loyalty_ledger_pending_idx on public.loyalty_ledger (available_at) where status = 'pending';
alter table public.loyalty_ledger enable row level security;
drop policy if exists "read own points" on public.loyalty_ledger;
create policy "read own points" on public.loyalty_ledger for select to authenticated using (
  (business_account_id is null and (profile_id = auth.uid() or lower(email) = lower(auth.jwt() ->> 'email')))
  or (business_account_id is not null and exists (select 1 from public.business_members m where m.account_id = loyalty_ledger.business_account_id and m.profile_id = auth.uid()))
);
drop policy if exists staff_all on public.loyalty_ledger;
create policy staff_all on public.loyalty_ledger for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- credit codes made from points
alter table public.promo_codes drop constraint if exists promo_codes_source_check;
alter table public.promo_codes add constraint promo_codes_source_check check (source in ('staff','gift_card','referral','referral_reward','loyalty'));

-- Points → credit code, atomically: locks the account, checks the available balance, writes both rows.
create or replace function public.redeem_loyalty(p_profile uuid, p_email text, p_business uuid, p_points int, p_code text, p_value numeric, p_who text)
returns text language plpgsql security definer set search_path = public as $$
declare avail int;
begin
  if p_points <= 0 then raise exception 'points must be positive'; end if;
  perform pg_advisory_xact_lock(hashtext('loyalty:' || coalesce(p_business::text, p_profile::text, lower(p_email))));
  select coalesce(sum(points), 0) into avail from public.loyalty_ledger
   where status = 'available'
     and (case when p_business is not null then business_account_id = p_business
               else business_account_id is null and (profile_id = p_profile or lower(email) = lower(p_email)) end);
  if avail < p_points then return null; end if;
  insert into public.promo_codes (code, kind, value, balance, source, owner_profile_id, note, created_by)
  values (p_code, 'gift', p_value, p_value, 'loyalty', p_profile, 'Handled Points credit · ' || p_points || ' points', p_who);
  insert into public.loyalty_ledger (profile_id, email, business_account_id, kind, points, status, code, note, created_by)
  values (p_profile, lower(p_email), p_business, 'redeem', -p_points, 'available', p_code, 'Credit ' || p_code, p_who);
  return p_code;
end $$;
revoke all on function public.redeem_loyalty(uuid, text, uuid, int, text, numeric, text) from public, anon, authenticated;
