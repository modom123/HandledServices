-- ============================================================================
-- FILE    : supabase/migrations/20261001190000_upfront_payment.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-01_1900 UTC
-- PURPOSE : Paid upfront, always. No job is dispatched to a pro until the customer
--           has paid. When something isn't right we make it right with a free redo,
--           a complimentary extra service, or a refund, never by withholding payment.
--           Remedies are built so a job can't go below $0 for us:
--             • refunds come out of the job proportionally (or from the pro first when
--               the pro was at fault); a payout already sent becomes a clawback against
--               the pro's next payout
--             • a complimentary service's payout is capped at our take on the original job
-- ============================================================================

alter table public.jobs
  add column paid_at timestamptz,
  add column amount_paid numeric(10,2) not null default 0,
  add column amount_refunded numeric(10,2) not null default 0,
  add column stripe_payment_intent text,
  add column parent_job_id uuid references public.jobs(id) on delete set null,
  add column remedy text check (remedy in ('redo','complimentary'));

alter table public.jobs add constraint jobs_refund_le_paid check (amount_refunded <= amount_paid);

-- Payout clawbacks (negative rows deducted from the pro's next payout run)
alter table public.payouts drop constraint if exists payouts_positive;
alter table public.payouts drop constraint if exists payouts_status_check;
alter table public.payouts add constraint payouts_status_check check (status in ('pending','approved','paid','held','clawback'));
alter table public.payouts add constraint payouts_sign check ((status = 'clawback' and amount < 0) or (status <> 'clawback' and amount >= 0));
alter table public.payouts add column reason text;

-- Payout guard: normal jobs ≤ 85% of price; a complimentary job (price 0) may pay the
-- pro at most our take on the original job, so the pair of jobs never goes negative.
create or replace function public.guard_payout_amount() returns trigger
language plpgsql security definer set search_path = public as $$
declare j record; parent_take numeric;
begin
  if new.job_id is null or new.status = 'clawback' then return new; end if;
  select price_final, parent_job_id, remedy into j from public.jobs where id = new.job_id;
  if j.remedy = 'complimentary' and j.parent_job_id is not null then
    select coalesce(price_final, 0) - coalesce(contractor_payout, 0) - coalesce(amount_refunded, 0)
      into parent_take from public.jobs where id = j.parent_job_id;
    if new.amount > greatest(parent_take, 0) then
      raise exception 'Complimentary payout % exceeds our take % on the original job', new.amount, parent_take;
    end if;
  elsif j.price_final is not null and new.amount > j.price_final * 0.85 then
    raise exception 'Payout % exceeds 85%% of job price % — take would fall below 15%%', new.amount, j.price_final;
  end if;
  return new;
end $$;

-- Take-rate band still applies to paid jobs; redo/complimentary jobs are priced at $0.
alter table public.jobs drop constraint jobs_take_rate_band;
alter table public.jobs add constraint jobs_take_rate_band check (
  contractor_payout is null or price_final is null or price_final = 0 or remedy is not null
  or amount_refunded > 0          -- refunds lower the payout via refundSplit(); our take is tested ≥ 0 there
  or (contractor_payout <= price_final * 0.85 and contractor_payout >= floor(price_final * 0.65) - 1)
);

alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check check (kind in ('deposit','final','milestone','plan','upfront','refund'));
