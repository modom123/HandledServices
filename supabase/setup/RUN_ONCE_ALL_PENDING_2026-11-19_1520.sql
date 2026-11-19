-- ============================================================================
-- FILE    : supabase/setup/RUN_ONCE_ALL_PENDING_2026-11-19_1520.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-11-19_1520 UTC
-- HOW     : Supabase → SQL Editor → New query → paste ALL of this → Run. Safe to run twice: anything already done
--           is skipped. Everything added since 2026-11-17, in the order it must run (the Sales Force part is last:
--           it widens the commission types that the partner-agreement part sets).
--             1. Call appointments            (RUN_ONCE_CALL_APPOINTMENTS_2026-11-17_1530.sql)
--             2. PayPal / Venmo payouts       (RUN_ONCE_PAYPAL_VENMO_PAYOUTS_2026-11-17_1900.sql)
--             3. Partner agreement, v7        (RUN_ONCE_PARTNER_AGREEMENT_2026-11-17_2100.sql)
--             4. Front Office to-dos          (RUN_ONCE_OFFICE_TODOS_2026-11-17_2300.sql)
--             5. AI outreach, handledsvc.net  (ADD_AI_OUTREACH_HANDLEDSVC_NET_2026-11-17_2335.sql)
--             6. Walkthroughs                 (ADD_WALKTHROUGHS_2026-11-17_2350.sql)
--             7. Business pricing             (ADD_BUSINESS_PRICING_2026-11-18_0040.sql)
--             8. Sales Force                  (ADD_SALES_FORCE_2026-11-18_0105.sql)
-- ============================================================================


-- ════════ 1. RUN_ONCE_CALL_APPOINTMENTS_2026-11-17_1530.sql ════════
-- ============================================================================
-- FILE    : supabase/setup/RUN_ONCE_CALL_APPOINTMENTS_2026-11-17_1530.sql (same as migrations/20261117153000_call_appointments.sql; paste into the Supabase SQL editor)
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-11-17_1530 UTC
-- PURPOSE : Call appointments: a lead can book a time for a Handled person to call (Post your project, the AI project
--           manager). call_at = the booked time (UTC); call_tz = the customer's time zone, for their confirmation.
--           Call hours (days, slot length, people taking calls) live in site_settings, key "call_hours" (Hub -> Lead
--           inbox). Rules: packages/core/src/call-schedule.ts. Server-only columns (leads are admin-read). Safe to run twice.
-- ============================================================================
alter table public.leads add column if not exists call_at timestamptz;
alter table public.leads add column if not exists call_tz text;
create index if not exists leads_call_at_idx on public.leads (call_at) where call_at is not null;


-- ════════ 2. RUN_ONCE_PAYPAL_VENMO_PAYOUTS_2026-11-17_1900.sql ════════
-- ============================================================================
-- FILE    : supabase/setup/RUN_ONCE_PAYPAL_VENMO_PAYOUTS_2026-11-17_1900.sql (same as migrations/20261117190000_payout_paypal_venmo.sql; paste into the Supabase SQL editor)
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-11-17_1900 UTC
-- PURPOSE : Pros choose how they're paid: direct deposit to their bank (Stripe, free), PayPal or Venmo (PayPal Payouts
--           API, $1.50 per payout kept by Handled). Rules: packages/core/src/payout-rails.ts.
--             contractors.payout_method  + 'paypal', 'venmo'
--             contractors.payout_handle  PayPal email / Venmo phone (+1...)
--             payouts.rail               'stripe' | 'paypal' | 'venmo' (how that payout was sent)
--             payouts.rail_fee           Handled's fee on that payout (rows stay gross = the 1099 amount)
--             payouts.rail_ref           PayPal payout batch id / item id
--             payouts.rail_status        PayPal item status (SUCCESS, UNCLAIMED, RETURNED...)
--           Server-only columns (money is admin-read). Safe to run twice.
-- ============================================================================
alter table public.contractors drop constraint if exists contractors_payout_method_check;
alter table public.contractors add constraint contractors_payout_method_check
  check (payout_method is null or payout_method in ('ach','stripe_connect','check','paypal','venmo'));
alter table public.contractors add column if not exists payout_handle text;

alter table public.payouts add column if not exists rail text check (rail is null or rail in ('stripe','paypal','venmo'));
alter table public.payouts add column if not exists rail_fee numeric(10,2) not null default 0 check (rail_fee >= 0);
alter table public.payouts add column if not exists rail_ref text;
alter table public.payouts add column if not exists rail_status text;
create index if not exists payouts_rail_pending_idx on public.payouts (rail, rail_status) where rail in ('paypal','venmo');


-- ════════ 3. RUN_ONCE_PARTNER_AGREEMENT_2026-11-17_2100.sql ════════
-- ============================================================================
-- FILE    : supabase/setup/RUN_ONCE_PARTNER_AGREEMENT_2026-11-17_2100.sql (same as migrations/20261117210000_partner_agreement.sql; paste into the Supabase SQL editor)
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-11-17_2100 UTC
-- PURPOSE : The Referral Partner Agreement (partner-v6) is a signed contract: contract_acceptances can now record
--           audience 'partner' (who signed, when, IP, the exact text and its hash).
--           partner-v7 (one program): partner_commissions.tier + 'program' (a referral) and 'sale' (a direct sale), both
--           a share of Handled's profit. Safe to run twice.
-- ============================================================================
alter table public.contract_acceptances drop constraint if exists contract_acceptances_audience_check;
alter table public.contract_acceptances add constraint contract_acceptances_audience_check
  check (audience in ('customer','business','pro','partner'));

alter table public.partner_commissions drop constraint if exists partner_commissions_tier_check;
alter table public.partner_commissions add constraint partner_commissions_tier_check
  check (tier is null or tier in ('one_time','repeat','account','legacy','direct','self','sale','program'));


-- ════════ 4. RUN_ONCE_OFFICE_TODOS_2026-11-17_2300.sql ════════
-- ============================================================================
-- FILE    : supabase/setup/RUN_ONCE_OFFICE_TODOS_2026-11-17_2300.sql (same as migrations/20261117230000_office_todos.sql; paste into the Supabase SQL editor)
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-11-17_2300 UTC
-- PURPOSE : Front Office offices (Mark Odom, CEO; Cecilia Gulley, Chief Strategy & Recruiting): one shared to-do list
--           that goes back and forth between the two offices. Each item is on one office's desk (assigned_to); either
--           office can send it to the other with a note, and every hand-off is kept in history.
--           Server-only (admins through the Hub API). Safe to run twice.
-- ============================================================================
create table if not exists public.office_todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  details text,
  created_by_office text not null check (created_by_office in ('odom','gulley')),
  assigned_to text not null check (assigned_to in ('odom','gulley')),
  due_date date,
  priority text not null default 'normal' check (priority in ('normal','high')),
  status text not null default 'open' check (status in ('open','done')),
  history jsonb not null default '[]'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists office_todos_desk on public.office_todos (assigned_to, status, due_date);
alter table public.office_todos enable row level security;


-- ════════ 5. ADD_AI_OUTREACH_HANDLEDSVC_NET_2026-11-17_2335.sql ════════
-- ============================================================================
-- FILE    : supabase/setup/ADD_AI_OUTREACH_HANDLEDSVC_NET_2026-11-17_2335.sql
-- HOW     : Supabase → SQL Editor → paste all of this → Run. (Same as migration 20261117233500_ai_outreach_handledsvc_net.sql.)
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-11-17_2335 UTC
-- PURPOSE : AI email outreach from handledsvc.net (the marketing / outreach domain).
--             settings.ai_personalize   — the AI writer personalizes each cold email (guardrails in core outreach-ai.ts)
--             thread_message_id/subject — email 1's Message-ID, so follow-ups reply in the same thread
--             reply_*                   — the business's last reply (their words, Message-ID, subject), the AI's
--                                         checked draft answer and when staff answered it from the Hub
--           Safe to run twice.
-- ============================================================================
alter table public.biz_lead_settings add column if not exists ai_personalize boolean not null default true;

alter table public.biz_leads add column if not exists thread_message_id text;
alter table public.biz_leads add column if not exists thread_subject text;
alter table public.biz_leads add column if not exists reply_text text;
alter table public.biz_leads add column if not exists reply_message_id text;
alter table public.biz_leads add column if not exists reply_references text;
alter table public.biz_leads add column if not exists reply_subject text;
alter table public.biz_leads add column if not exists reply_at timestamptz;
alter table public.biz_leads add column if not exists reply_draft text;
alter table public.biz_leads add column if not exists reply_intent text;
alter table public.biz_leads add column if not exists reply_answered_at timestamptz;
create index if not exists biz_leads_reply_waiting_idx on public.biz_leads (reply_at) where reply_at is not null and reply_answered_at is null;


-- ════════ 6. ADD_WALKTHROUGHS_2026-11-17_2350.sql ════════
-- ============================================================================
-- FILE    : supabase/setup/ADD_WALKTHROUGHS_2026-11-17_2350.sql
-- HOW     : Supabase → SQL Editor → paste all of this → Run. (Same as migration 20261117235000_walkthroughs.sql.)
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-11-17_2350 UTC
-- PURPOSE : Free walkthroughs businesses book themselves (/walkthrough, core walkthrough.ts).
--             walkthroughs          — one booking: on-site walkthrough or a short call, who, where, what they need,
--                                     the sales lead it came from, a private token for their manage link
--             walkthrough_settings  — hours, days, slot length, bookings per slot, lead time, how far ahead
--           Server-only (service role); admins can read and change them in the Hub. Safe to run twice.
-- ============================================================================
create table if not exists public.walkthroughs (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  kind text not null default 'onsite' check (kind in ('onsite','call')),
  starts_at timestamptz not null,
  minutes int not null default 45,
  status text not null default 'booked' check (status in ('booked','done','no_show','cancelled')),
  name text not null,
  company text not null,
  email text not null,
  phone text,
  address text,
  city text,
  state text,
  zip text,
  segment text,
  landing text,
  needs text,
  properties int,
  biz_lead_id uuid references public.biz_leads(id) on delete set null,
  attribution jsonb,
  staff_notes text,
  assigned_to text,
  reminded_at timestamptz,
  followed_up_at timestamptz,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists walkthroughs_starts_idx on public.walkthroughs (starts_at) where status = 'booked';
create index if not exists walkthroughs_lead_idx on public.walkthroughs (biz_lead_id);
alter table public.walkthroughs enable row level security;

create table if not exists public.walkthrough_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default true,
  days int[] not null default '{1,2,3,4,5}',
  start_min int not null default 540 check (start_min between 0 and 1439),
  end_min int not null default 1020 check (end_min between 1 and 1440),
  slot_minutes int not null default 30 check (slot_minutes between 10 and 240),
  per_slot int not null default 1 check (per_slot between 1 and 20),
  lead_hours int not null default 18 check (lead_hours between 0 and 168),
  horizon_days int not null default 14 check (horizon_days between 1 and 60),
  time_zone text not null default 'America/Detroit',
  notify_emails text,
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.walkthrough_settings (id) values (1) on conflict (id) do nothing;
alter table public.walkthrough_settings enable row level security;

do $$ begin
  if exists (select 1 from pg_proc where proname = 'is_admin') then
    execute 'drop policy if exists admin_all on public.walkthroughs';
    execute 'create policy admin_all on public.walkthroughs for all to authenticated using (public.is_admin()) with check (public.is_admin())';
    execute 'drop policy if exists admin_all on public.walkthrough_settings';
    execute 'create policy admin_all on public.walkthrough_settings for all to authenticated using (public.is_admin()) with check (public.is_admin())';
  end if;
end $$;


-- ════════ 7. ADD_BUSINESS_PRICING_2026-11-18_0040.sql ════════
-- ============================================================================
-- FILE    : supabase/setup/ADD_BUSINESS_PRICING_2026-11-18_0040.sql
-- HOW     : Supabase → SQL Editor → paste all of this → Run. (Same as migration 20261118004000_business_pricing.sql.)
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-11-18_0040 UTC
-- PURPOSE : Business pricing (core BUSINESS_PRICING): business orders keep up to 50% for Handled, and the pro is paid
--           the same dollars the job pays at home prices.
--             jobs.business_pricing — this job is priced at business prices (repricing keeps the pro's home-price pay)
--             jobs_take_rate_band   — home jobs: pro paid 60–85% of the list price (unchanged); business-priced jobs:
--                                     50–85%. Every other rule is the same as 20261009030000_handled_uplift.
--           Safe to run twice.
-- ============================================================================
alter table public.jobs add column if not exists business_pricing boolean not null default false;
alter table public.jobs drop constraint if exists jobs_take_rate_band;
alter table public.jobs add constraint jobs_take_rate_band check (
  contractor_payout is null or price_final is null or price_final = 0 or remedy is not null
  or amount_refunded > 0
  or (contractor_payout <= (price_final + coalesce(discount, 0) + coalesce(member_benefit, 0)) * 0.85
      and contractor_payout >= floor((price_final + coalesce(discount, 0) + coalesce(member_benefit, 0)) * (case when business_pricing then 0.50 else 0.60 end)) - 1)
) not valid;


-- ════════ 8. ADD_SALES_FORCE_2026-11-18_0105.sql ════════
-- ============================================================================
-- FILE    : supabase/setup/ADD_SALES_FORCE_2026-11-18_0105.sql
-- HOW     : Supabase → SQL Editor → paste all of this → Run (after ADD_WALKTHROUGHS_2026-11-17_2350.sql). Same as migration 20261118010500_sales_force.sql.
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

-- a Sales Force rep's customer after their first 12 months: the rep's book share (tier 'book'); keeps partner-v7's 'program' / 'sale'
alter table public.partner_commissions drop constraint if exists partner_commissions_tier_check;
alter table public.partner_commissions add constraint partner_commissions_tier_check
  check (tier is null or tier in ('one_time','repeat','account','legacy','direct','self','program','sale','book'));
