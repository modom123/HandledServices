-- ============================================================================
-- FILE    : supabase/migrations/20261001212400_pro_benefits.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-01_2124 UTC
-- PURPOSE : The six Pro Program benefits.
--             • pro_program_settings — who qualifies for each benefit and its amounts
--               (Handled Hub → Pro Program; defaults live in packages/core/src/pro-policy.ts)
--             • payouts.kind — job | show_up | guarantee | stipend | materials | clawback,
--               plus instant-pay method, fee and Stripe transfer. Only 'job' payouts are
--               held to the 85%-of-price guard; show-up pay is capped in code at the fee we
--               keep; materials are passed through only after the customer pays them.
--             • job_expenses — materials receipts from pros (auto-approve / staff review)
--             • jobs cancellation record — who cancelled, when, why and the fee kept
-- ============================================================================

create table public.pro_program_settings (
  id int primary key default 1 check (id = 1),
  settings jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.pro_program_settings enable row level security;
create policy staff_all on public.pro_program_settings for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy settings_read on public.pro_program_settings for select to authenticated using (true);
insert into public.pro_program_settings (id) values (1) on conflict (id) do nothing;

alter table public.payouts
  add column kind text not null default 'job' check (kind in ('job','show_up','guarantee','stipend','materials','clawback')),
  add column method text check (method in ('weekly','instant','manual')),
  add column instant_fee numeric(10,2) not null default 0,
  add column stripe_transfer_id text;
update public.payouts set kind = 'clawback' where status = 'clawback';
create index payouts_contractor_status_idx on public.payouts(contractor_id, status);

-- The 85%-of-price guard applies to the job's own payout; complimentary rules unchanged.
create or replace function public.guard_payout_amount() returns trigger
language plpgsql security definer set search_path = public as $$
declare j record; parent_take numeric;
begin
  if new.job_id is null or new.status = 'clawback' or new.kind <> 'job' then return new; end if;
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

create table public.job_expenses (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  description text not null,
  receipt_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','billed','paid')),
  decided_by text,
  decided_at timestamptz,
  payment_id uuid references public.payments(id) on delete set null,
  payout_id uuid references public.payouts(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);
create index job_expenses_job_idx on public.job_expenses(job_id);
alter table public.job_expenses enable row level security;
create policy staff_all on public.job_expenses for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy expenses_pro_read on public.job_expenses for select to authenticated using (contractor_id = public.my_contractor_id());

alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check
  check (kind in ('deposit','final','milestone','plan','upfront','refund','balance','change_order','custom','materials'));

alter table public.jobs
  add column cancelled_at timestamptz,
  add column cancel_reason text check (cancel_reason in ('customer','late','lockout','ops','weather','pro')),
  add column cancel_fee numeric(10,2) not null default 0;

alter table public.contractors add column insurance_stipend_paid_at timestamptz;
