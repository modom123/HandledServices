-- ============================================================================
-- FILE    : supabase/migrations/20261002031601_launch_growth.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-02_0316 UTC
-- PURPOSE : Launch blockers + growth + customer experience, in one place:
--             • rate_limits + hit_rate_limit()   — abuse limits on public endpoints (AI, uploads)
--             • payment_disputes                 — Stripe chargebacks: payout held, ops alerted
--             • promo_codes / promo_redemptions  — promo codes, gift cards, referral rewards
--             • memberships                      — Handled Plus (monthly subscription)
--             • tips                             — 100% to the pro
--             • jobs: discount, promo_code, attribution, en_route_at
--             • profiles: locale, sms_opt_out, referred_by, referral_rewarded_at,
--               deleted_at (account deletion keeps tax/financial records, drops personal data)
-- ============================================================================

-- ─── Abuse limits ───────────────────────────────────────────────────────────
create table if not exists public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;

-- Atomically count a hit; true = allowed. Window is fixed (e.g. 3600s = per hour).
create or replace function public.hit_rate_limit(p_key text, p_window_seconds int, p_max int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n int;
begin
  insert into public.rate_limits as r (key, window_start, hits) values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into n;
  return n <= p_max;
end $$;
revoke all on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;

-- ─── Chargebacks ────────────────────────────────────────────────────────────
create table if not exists public.payment_disputes (
  id uuid primary key default gen_random_uuid(),
  stripe_dispute_id text not null unique,
  payment_intent text,
  job_id uuid references public.jobs(id) on delete set null,
  amount numeric(10,2) not null,
  reason text,
  status text not null,
  evidence_due_by timestamptz,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
alter table public.payment_disputes enable row level security;

-- ─── Money kinds ────────────────────────────────────────────────────────────
alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check
  check (kind in ('deposit','final','milestone','plan','upfront','refund','balance','change_order','custom','materials','tip','gift_card','membership'));

alter table public.payouts drop constraint if exists payouts_kind_check;
alter table public.payouts add constraint payouts_kind_check
  check (kind in ('job','show_up','guarantee','stipend','materials','clawback','referral','tip'));

-- ─── Promo codes, gift cards, referral rewards ──────────────────────────────
create table if not exists public.promo_codes (
  code text primary key check (code = upper(code) and length(code) between 3 and 40),
  kind text not null check (kind in ('percent','amount','gift')),
  value numeric(10,2) not null check (value > 0),
  balance numeric(10,2),                         -- gift cards / referral credit: what's left
  max_uses int,                                  -- null = unlimited
  uses int not null default 0,
  first_job_only boolean not null default false,
  min_order numeric(10,2) not null default 0,
  expires_at timestamptz,
  active boolean not null default true,
  source text not null default 'staff' check (source in ('staff','gift_card','referral','referral_reward')),
  owner_profile_id uuid references public.profiles(id) on delete set null,
  purchaser_email text,
  recipient_email text,
  note text,
  created_by text,
  payment_id uuid references public.payments(id) on delete set null, -- gift card purchase
  created_at timestamptz not null default now()
);
alter table public.promo_codes enable row level security;

create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.promo_codes(code),
  job_id uuid references public.jobs(id) on delete set null,
  email text,
  amount numeric(10,2) not null,
  created_at timestamptz not null default now()
);
alter table public.promo_redemptions enable row level security;
create index if not exists promo_redemptions_code_idx on public.promo_redemptions (code);

-- Atomic gift-card / credit draw-down: takes up to p_amount, returns what was taken.
create or replace function public.draw_promo_balance(p_code text, p_amount numeric)
returns numeric language plpgsql security definer set search_path = public as $$
declare b numeric; took numeric;
begin
  select balance into b from public.promo_codes
   where code = p_code and active and coalesce(balance, 0) > 0 and (expires_at is null or expires_at > now())
   for update;
  if not found then return 0; end if;
  took := least(b, p_amount);
  update public.promo_codes set balance = b - took, uses = uses + 1 where code = p_code;
  return took;
end $$;
revoke all on function public.draw_promo_balance(text, numeric) from public, anon, authenticated;

-- ─── Handled Plus membership ────────────────────────────────────────────────
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  email text not null,
  status text not null default 'pending' check (status in ('pending','active','past_due','canceled')),
  plan text not null default 'plus_monthly',
  stripe_customer_id text,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  canceled_at timestamptz
);
alter table public.memberships enable row level security;
create index if not exists memberships_email_idx on public.memberships (lower(email));
create policy "own membership" on public.memberships for select using (profile_id = auth.uid());

-- ─── Tips ───────────────────────────────────────────────────────────────────
create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  contractor_id uuid references public.contractors(id) on delete set null,
  amount numeric(10,2) not null check (amount > 0),
  payment_id uuid references public.payments(id),
  status text not null default 'pending' check (status in ('pending','paid')),
  created_at timestamptz not null default now()
);
alter table public.tips enable row level security;

-- ─── Jobs & profiles ────────────────────────────────────────────────────────
alter table public.jobs
  add column if not exists promo_code text,
  add column if not exists discount numeric(10,2) not null default 0,
  add column if not exists member_benefit numeric(10,2) not null default 0,
  add column if not exists attribution jsonb,
  add column if not exists en_route_at timestamptz,
  add column if not exists tip_total numeric(10,2) not null default 0,
  add column if not exists disputed_at timestamptz;

alter table public.profiles
  add column if not exists locale text not null default 'en' check (locale in ('en','es')),
  add column if not exists sms_opt_out boolean not null default false,
  add column if not exists referred_by uuid references public.profiles(id) on delete set null,
  add column if not exists referral_rewarded_at timestamptz,
  add column if not exists deleted_at timestamptz;

-- ─── Account deletion: nothing may block removing a person ──────────────────
alter table public.messages drop constraint if exists messages_sender_id_fkey;
alter table public.messages add constraint messages_sender_id_fkey foreign key (sender_id) references public.profiles(id) on delete set null;
alter table public.business_accounts drop constraint if exists business_accounts_owner_profile_id_fkey;
alter table public.business_accounts add constraint business_accounts_owner_profile_id_fkey foreign key (owner_profile_id) references public.profiles(id) on delete set null;
