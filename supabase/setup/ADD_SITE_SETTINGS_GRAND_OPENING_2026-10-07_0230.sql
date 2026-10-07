-- ============================================================================
-- FILE    : supabase/setup/ADD_SITE_SETTINGS_GRAND_OPENING_2026-10-07_0230.sql
-- PROJECT : Handled Services LLC (HandledServices) — Website looks + grand opening promotion
-- CREATED : 2026-10-07_0230 UTC
-- PURPOSE : For the EXISTING Supabase project: settings table for Hub → Website & promotions, and the fix that lets
--           discounted bookings through the take-rate guard. Same as migration 20261007023000_site_settings_grand_opening.sql.
--           Run once in Supabase → SQL Editor. Safe to run twice.
-- ============================================================================
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.site_settings enable row level security;
drop policy if exists staff_all on public.site_settings;
create policy staff_all on public.site_settings for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ─── Take-rate guard measured on the list price ──────────────────────────────
alter table public.jobs drop constraint if exists jobs_take_rate_band;
alter table public.jobs add constraint jobs_take_rate_band check (
  contractor_payout is null or price_final is null or price_final = 0 or remedy is not null
  or amount_refunded > 0
  or (contractor_payout <= (price_final + coalesce(discount, 0) + coalesce(member_benefit, 0)) * 0.85
      and contractor_payout >= floor((price_final + coalesce(discount, 0) + coalesce(member_benefit, 0)) * 0.65) - 1)
) not valid;

create or replace function public.guard_payout_amount() returns trigger
language plpgsql security definer set search_path = public as $$
declare j record; parent_take numeric; list numeric;
begin
  if new.job_id is null or new.status = 'clawback' or new.kind <> 'job' then return new; end if;
  select price_final, parent_job_id, remedy, discount, member_benefit into j from public.jobs where id = new.job_id;
  if j.remedy = 'complimentary' and j.parent_job_id is not null then
    select coalesce(price_final, 0) - coalesce(contractor_payout, 0) - coalesce(amount_refunded, 0)
      into parent_take from public.jobs where id = j.parent_job_id;
    if new.amount > greatest(parent_take, 0) then
      raise exception 'Complimentary payout % exceeds our take % on the original job', new.amount, parent_take;
    end if;
  elsif j.price_final is not null then
    list := j.price_final + coalesce(j.discount, 0) + coalesce(j.member_benefit, 0);
    if new.amount > list * 0.85 then
      raise exception 'Payout % exceeds 85%% of the job''s list price % — take would fall below 15%%', new.amount, list;
    end if;
  end if;
  return new;
end $$;
