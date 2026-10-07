-- ============================================================================
-- FILE    : supabase/migrations/20261007023000_site_settings_grand_opening.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-07_0230 UTC
-- PURPOSE : Small key/value settings staff change from the Hub without a redeploy:
--             site_theme      - the website look shown by default ("classic" | "greengold" | "modern")
--             launch_promo    - the grand opening promotion (start date, days, percent, on/off)
--           Read by the server only; staff edit through the Hub.
--           ALSO fixes the take-rate guard for discounts. Discounts (promo codes, Plus, the grand opening, business pilots)
--           lower price_final while the pro keeps the payout set on the list price, so "payout <= 85% of price_final"
--           rejected discounted bookings (a 20% discount on a typical job broke the insert). The band is now measured on
--           the list price (price_final + discount + member_benefit), which is what the pricing code always intended:
--           discounts come out of our share, never the pro's pay. Old rows aren't re-checked (NOT VALID).
--           Safe to run twice.
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
