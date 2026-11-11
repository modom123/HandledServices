-- ============================================================================
-- FILE    : supabase/setup/ADD_LEAD_PAY_2026-11-10_0400.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-11-10_0400 UTC
-- PURPOSE : Lead pay for Field Sales partners (partner-v5): $10 for every lead (a close-ready sales ticket for a new
--           customer), as a draw (an advance) against that lead's commission. It unlocks once the partner has written
--           10 leads AND at least one of their sales has closed and been paid out; until then it builds up, then the
--           whole balance goes out on the next weekly payout. When the lead's job pays a commission, the $10 is taken
--           back out of it (recovered). A lead that never closes keeps its $10. Max 25 leads a week. Admins can void a
--           fake lead's unpaid lead pay. Rules: packages/core/src/partners.ts SALES_DRAW.
--             partner_draws - one row per lead: pending -> paid (or void); `recovered` = how much was repaid from commission
--           Run once in Supabase -> SQL Editor, after ADD_FIELD_SALES_2026-11-06_1638.sql (same as migration
--           20261110040000_lead_pay.sql). Admin-only (the server pays it and shows partners their own totals). Safe to run twice.
-- ============================================================================
create table if not exists public.partner_draws (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.referral_partners(id) on delete cascade,
  ticket_id uuid not null unique references public.sales_tickets(id) on delete cascade,
  amount numeric(10,2) not null check (amount >= 0),
  recovered numeric(10,2) not null default 0 check (recovered >= 0),
  status text not null default 'pending' check (status in ('pending','paid','void')),
  note text,
  paid_at timestamptz,
  week_of date,
  stripe_transfer_id text,
  created_at timestamptz not null default now()
);
create index if not exists partner_draws_partner_idx on public.partner_draws (partner_id, created_at desc);
create index if not exists partner_draws_status_idx on public.partner_draws (status);

alter table public.partner_draws enable row level security;
drop policy if exists admin_all on public.partner_draws;
do $$ begin
  if exists (select 1 from pg_proc where proname = 'is_admin' and pronamespace = 'public'::regnamespace) then
    execute 'create policy admin_all on public.partner_draws for all to authenticated using (public.is_admin()) with check (public.is_admin())';
  else
    execute 'create policy admin_all on public.partner_draws for all to authenticated using (public.app_role() = ''admin'') with check (public.app_role() = ''admin'')';
  end if;
end $$;
