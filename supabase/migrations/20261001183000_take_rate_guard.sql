-- ============================================================================
-- FILE    : supabase/migrations/20261001183000_take_rate_guard.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-01_1830 UTC
-- PURPOSE : Never lose money on a job. The database rejects any job whose
--           subcontractor payout would leave us outside a 15–35% take, and any payout
--           larger than the job price. Mirrors splitJob() in packages/core/src/pricing.ts
--           (payouts round down, so the lower bound allows $1 of rounding).
-- ============================================================================

alter table public.jobs add constraint jobs_take_rate_band check (
  contractor_payout is null or price_final is null or price_final = 0
  or (contractor_payout <= price_final * 0.85 and contractor_payout >= floor(price_final * 0.65) - 1)
);

alter table public.payouts add constraint payouts_positive check (amount >= 0);

-- A payout can never exceed what the customer was charged for that job.
create or replace function public.guard_payout_amount() returns trigger
language plpgsql security definer set search_path = public as $$
declare p numeric;
begin
  if new.job_id is null then return new; end if;
  select price_final into p from public.jobs where id = new.job_id;
  if p is not null and new.amount > p * 0.85 then
    raise exception 'Payout % exceeds 85%% of job price % — take would fall below 15%%', new.amount, p;
  end if;
  return new;
end $$;
create trigger payouts_guard before insert or update of amount on public.payouts for each row execute function public.guard_payout_amount();

alter table public.services add constraint services_payout_share_band check (payout_share between 0.65 and 0.85);
