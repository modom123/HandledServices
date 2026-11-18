-- ============================================================================
-- FILE    : supabase/migrations/20261118010500_sales_force.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-11-18_0105 UTC
-- PURPOSE : The Handled Sales Force goes live (core sales-force.ts, web lib/sales-force.ts). Independent contractors (1099).
--             referral_partners.sales_rank       — their rank (associate → vp); null = not in the Sales Force
--             referral_partners.sales_leader_id  — the leader whose team they're on (recruited them)
--             referral_partners.sales_rank_at    — when they reached it
--             sales_pay        — pay lines beyond the seller's own commission: team share (override) on a team member's
--                                job, walkthrough held ($25), first sale ($100), promotion bonus. Paid in the Monday
--                                partner payout run with the commissions; job lines follow refunds down.
--             sales_rank_history — every rank change (automatic from cumulative totals, or by an admin)
--             walkthroughs.partner_id — the rep whose link the business came from
--             partner_commissions tier 'book' — a rep's book share on their clients after the first 12 months
--           Everyone already signed up as a Field Sales partner (kind sales_rep) starts as an Associate AE; their
--           commission never drops below their current ladder rate. Admin-only. Safe to run twice.
-- ============================================================================
alter table public.referral_partners add column if not exists sales_rank text;
alter table public.referral_partners drop constraint if exists referral_partners_sales_rank_check;
alter table public.referral_partners add constraint referral_partners_sales_rank_check check (sales_rank is null or sales_rank in
  ('associate','ae','senior_ae','principal_ae','team_lead','manager','director','vp'));
alter table public.referral_partners add column if not exists sales_leader_id uuid references public.referral_partners(id) on delete set null;
alter table public.referral_partners add column if not exists sales_rank_at timestamptz;
create index if not exists referral_partners_leader_idx on public.referral_partners (sales_leader_id);
update public.referral_partners set sales_rank = 'associate', sales_rank_at = now() where kind = 'sales_rep' and sales_rank is null;

create table if not exists public.sales_pay (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.referral_partners(id) on delete cascade,
  kind text not null check (kind in ('override','walkthrough','first_sale','promotion')),
  job_id uuid references public.jobs(id) on delete set null,
  walkthrough_id uuid references public.walkthroughs(id) on delete set null,
  from_partner_id uuid references public.referral_partners(id) on delete set null,
  rank text,
  share numeric(6,4),
  take numeric(10,2),
  amount numeric(10,2) not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending','paid','void')),
  eligible_at timestamptz not null default now(),
  note text,
  paid_at timestamptz,
  week_of date,
  stripe_transfer_id text,
  created_at timestamptz not null default now()
);
create unique index if not exists sales_pay_override_uq on public.sales_pay (partner_id, job_id) where kind = 'override';
create unique index if not exists sales_pay_walkthrough_uq on public.sales_pay (walkthrough_id) where kind = 'walkthrough';
create unique index if not exists sales_pay_first_sale_uq on public.sales_pay (partner_id) where kind = 'first_sale';
create unique index if not exists sales_pay_promotion_uq on public.sales_pay (partner_id, rank) where kind = 'promotion';
create index if not exists sales_pay_due_idx on public.sales_pay (status, eligible_at);
create index if not exists sales_pay_partner_idx on public.sales_pay (partner_id, created_at desc);

create table if not exists public.sales_rank_history (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.referral_partners(id) on delete cascade,
  from_rank text,
  to_rank text not null,
  by_whom text not null default 'automatic',
  note text,
  created_at timestamptz not null default now()
);
create index if not exists sales_rank_history_partner_idx on public.sales_rank_history (partner_id, created_at desc);

alter table public.walkthroughs add column if not exists partner_id uuid references public.referral_partners(id) on delete set null;

alter table public.sales_pay enable row level security;
alter table public.sales_rank_history enable row level security;
do $$ begin
  execute 'drop policy if exists admin_all on public.sales_pay';
  execute 'drop policy if exists admin_all on public.sales_rank_history';
  if exists (select 1 from pg_proc where proname = 'is_admin' and pronamespace = 'public'::regnamespace) then
    execute 'create policy admin_all on public.sales_pay for all to authenticated using (public.is_admin()) with check (public.is_admin())';
    execute 'create policy admin_all on public.sales_rank_history for all to authenticated using (public.is_admin()) with check (public.is_admin())';
  else
    execute 'create policy admin_all on public.sales_pay for all to authenticated using (public.app_role() = ''admin'') with check (public.app_role() = ''admin'')';
    execute 'create policy admin_all on public.sales_rank_history for all to authenticated using (public.app_role() = ''admin'') with check (public.app_role() = ''admin'')';
  end if;
end $$;

-- a Sales Force rep's customer after their first 12 months: the rep's book share (tier 'book')
alter table public.partner_commissions drop constraint if exists partner_commissions_tier_check;
alter table public.partner_commissions add constraint partner_commissions_tier_check
  check (tier is null or tier in ('one_time','repeat','account','legacy','direct','self','book'));
