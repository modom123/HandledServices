-- ============================================================================
-- FILE    : supabase/setup/HANDLED_SETUP_PART_5_of_5_2026-10-09_0242.sql
-- PROJECT : Handled (myhumanai)
-- CREATED : 2026-10-09_0242 UTC
-- PURPOSE : NEW Supabase project setup, part 5 of 5 (run IN ORDER, one at a time). Migrations 20261006201000_pro_business_address.sql .. 20261009030000_handled_uplift.sql.
--           Plain-ASCII (accented text uses U&'' escapes) so copy/paste can't corrupt it.
--           Supabase -> SQL Editor -> New query -> paste -> Run. Wait for "Success" before the next part.
--           LAST PART. When it succeeds: sign in once on the website, then run (with your email):
--             update public.profiles set role = 'admin' where email = 'YOU@YOURCOMPANY.COM';
-- ============================================================================
-- >>> migration 20261006201000_pro_business_address.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261006201000_pro_business_address.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-06_2010 UTC
-- PURPOSE : A pro's place of business (street, city, state, ZIP). Dispatch measures driving distance from it
--           (geocoded street address; ZIP centre when the lookup isn't available - base_located says which).
-- ============================================================================
alter table public.contractors
  add column if not exists base_address text,
  add column if not exists base_city text,
  add column if not exists base_state text check (base_state is null or base_state ~ '^[A-Z]{2}$'),
  add column if not exists base_located text check (base_located is null or base_located in ('address','zip'));


-- >>> migration 20261006212000_cancellation_tracking.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261006212000_cancellation_tracking.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-06_2120 UTC
-- PURPOSE : Track every cancellation, not just the ones that count against a pro:
--             pro_standing_events.kind adds 'free_cancel' (handed back 24h+ ahead - recorded, never counted).
--           Hub -> Cancellations & coverage and the pro's own record read these.
-- ============================================================================
alter table public.pro_standing_events drop constraint if exists pro_standing_events_kind_check;
alter table public.pro_standing_events add constraint pro_standing_events_kind_check
  check (kind in ('late_cancel','short_notice_cancel','free_cancel','excused_cancel','no_show','warning','suspension','deactivation','appeal','appeal_upheld','reinstated','note'));
create index if not exists pro_standing_kind_idx on public.pro_standing_events (kind, created_at desc);


-- >>> migration 20261006215500_xero_accounting.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261006215500_xero_accounting.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-06_2155 UTC
-- PURPOSE : Xero is the books of record; Stripe is where the money moves. This adds:
--             xero_connection    - the one connected Xero organisation: OAuth tokens (encrypted by the server,
--                                  never readable from the browser: RLS on, no policies) and the account mapping.
--             xero_sync_log      - one row per document pushed to Xero (daily Stripe summaries, payouts to the
--                                  bank, pro payout spends, business invoices and their payments). The unique
--                                  (kind, ref) makes every push happen once; a failed push is retried.
--             payments.tax_amount             - sales tax Stripe Tax added on top (kept out of revenue).
--             business_invoices.xero_invoice_id, business_accounts.xero_contact_id, contractors.xero_contact_id.
--           Hub -> Accounting (Xero) reads these. Safe to run twice.
-- ============================================================================
create table if not exists public.xero_connection (
  id int primary key default 1 check (id = 1),
  tenant_id text,
  tenant_name text,
  connection_id text,
  access_token text,            -- encrypted (AES-256-GCM) by apps/web/lib/xero.ts
  refresh_token text,           -- encrypted; Xero rotates it on every refresh (60-day life)
  expires_at timestamptz,
  scopes text,
  settings jsonb not null default '{}'::jsonb,   -- account codes, sync start date, reconcile flag
  connected_by text,
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.xero_connection enable row level security;
-- no policies on purpose: only the server (service role) reads or writes tokens

create table if not exists public.xero_sync_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('stripe_day','stripe_receive','stripe_spend','pro_payout','bank_payout','invoice','invoice_payment','invoice_void')),
  ref text not null,                 -- e.g. 2026-10-05, 2026-10-05:po_123, invoice id
  day date,                          -- the business day it belongs to (America/Detroit)
  status text not null default 'pending' check (status in ('pending','done','error','skipped')),
  xero_id text,                      -- BankTransactionID / BankTransferID / InvoiceID / PaymentID
  amount numeric(12,2),
  detail jsonb,
  error text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, ref)
);
create index if not exists xero_sync_log_day_idx on public.xero_sync_log (day desc, kind);
create index if not exists xero_sync_log_status_idx on public.xero_sync_log (status, updated_at desc);
alter table public.xero_sync_log enable row level security;
drop policy if exists staff_read on public.xero_sync_log;
create policy staff_read on public.xero_sync_log for select to authenticated using (public.is_staff());

alter table public.payments add column if not exists tax_amount numeric(12,2) not null default 0;
create index if not exists payments_pi_idx on public.payments (stripe_payment_intent_id) where stripe_payment_intent_id is not null;
create index if not exists payments_session_idx on public.payments (stripe_session_id) where stripe_session_id is not null;
alter table public.business_invoices add column if not exists xero_invoice_id text;
alter table public.business_accounts add column if not exists xero_contact_id text;
alter table public.contractors add column if not exists xero_contact_id text;


-- >>> migration 20261007010000_referral_partners.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261007010000_referral_partners.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-07_0100 UTC
-- PURPOSE : Referral Partner Program. Anyone signs up, shares a link or sends us a customer, and earns 10% of
--           Handled's take on that customer's completed jobs for 12 months, paid weekly via Stripe Connect after
--           the 30-day make-it-right window (rules: packages/core/src/partners.ts).
--             referral_partners    - the partner, their code, payout account, terms acceptance
--             referral_customers   - which partner a customer belongs to (one partner per customer email) and until when
--             partner_commissions  - one row per completed referred job: pending -> paid (or void)
--             jobs.partner_id      - the partner a job is credited to
--           Staff read/write through the Hub; partners see their own data through the server. Safe to run twice.
-- ============================================================================
create table if not exists public.referral_partners (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  email text not null unique,
  phone text,
  company text,
  kind text not null default 'other' check (kind in ('realtor','property_manager','contractor','business','customer','pro','other')),
  how text,                                  -- how they plan to refer
  status text not null default 'active' check (status in ('active','suspended')),
  profile_id uuid references public.profiles(id) on delete set null,
  stripe_account_id text,
  xero_contact_id text,
  terms_version text,
  terms_accepted_at timestamptz,
  terms_ip text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.referral_customers (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.referral_partners(id) on delete cascade,
  customer_email text not null unique,       -- lower-case; first partner wins
  customer_name text,
  customer_phone text,
  service_slug text,
  note text,
  source text not null default 'link' check (source in ('link','direct','staff')),
  first_job_id uuid references public.jobs(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists referral_customers_partner_idx on public.referral_customers (partner_id);

create table if not exists public.partner_commissions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.referral_partners(id) on delete cascade,
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  take numeric(12,2) not null,
  amount numeric(12,2) not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending','paid','void')),
  eligible_at timestamptz not null,
  paid_at timestamptz,
  week_of date,
  stripe_transfer_id text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists partner_commissions_due_idx on public.partner_commissions (status, eligible_at);
create index if not exists partner_commissions_partner_idx on public.partner_commissions (partner_id, created_at desc);

alter table public.jobs add column if not exists partner_id uuid references public.referral_partners(id) on delete set null;
create index if not exists jobs_partner_idx on public.jobs (partner_id) where partner_id is not null;

alter table public.referral_partners enable row level security;
alter table public.referral_customers enable row level security;
alter table public.partner_commissions enable row level security;
drop policy if exists staff_all on public.referral_partners;
create policy staff_all on public.referral_partners for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists staff_all on public.referral_customers;
create policy staff_all on public.referral_customers for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists staff_all on public.partner_commissions;
create policy staff_all on public.partner_commissions for all to authenticated using (public.is_staff()) with check (public.is_staff());


-- >>> migration 20261007023000_site_settings_grand_opening.sql
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

-- --- Take-rate guard measured on the list price ------------------------------
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
      raise exception 'Payout % exceeds 85%% of the job''s list price % - take would fall below 15%%', new.amount, list;
    end if;
  end if;
  return new;
end $$;


-- >>> migration 20261007030000_bid_measurements.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261007030000_bid_measurements.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-07_0300 UTC
-- PURPOSE : Bid engine measurements: the size of ONE unit of work on a price line (e.g. a 12-acre mowing visit,
--           a 40 cu yd clean-out), so the engine can estimate the pro cost from our pricing engine and the
--           deal-maker can price it. Safe to run twice.
-- ============================================================================
alter table public.bid_cost_lines add column if not exists measure_size numeric check (measure_size is null or measure_size >= 0);
alter table public.bid_cost_lines add column if not exists measure_unit text;


-- >>> migration 20261007040000_loyalty_points.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261007040000_loyalty_points.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-07_0530 UTC
-- PURPOSE : Handled Points - loyalty points for every customer account (rules: packages/core/src/loyalty.ts).
--             * loyalty_settings - earn rate, point value, pending days, expiry, bonuses (one row)
--             * loyalty_ledger   - every point movement for a person (profile_id / email) or a business account:
--                                  earn (per job, pending -> available), bonus, redeem (negative), adjust, expire
--             * redeem_loyalty() - turns points into a credit code in one step (no double spending)
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

-- Points -> credit code, atomically: locks the account, checks the available balance, writes both rows.
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
  values (p_code, 'gift', p_value, p_value, 'loyalty', p_profile, U&'Handled Points credit \00B7 ' || p_points || ' points', p_who);
  insert into public.loyalty_ledger (profile_id, email, business_account_id, kind, points, status, code, note, created_by)
  values (p_profile, lower(p_email), p_business, 'redeem', -p_points, 'available', p_code, 'Credit ' || p_code, p_who);
  return p_code;
end $$;
revoke all on function public.redeem_loyalty(uuid, text, uuid, int, text, numeric, text) from public, anon, authenticated;


-- >>> migration 20261007050000_more_service_areas.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261007050000_more_service_areas.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-07_1640 UTC
-- PURPOSE : Service areas beyond Metro Detroit (480-483): the rest of Michigan by region (Handled serves Michigan and Washington).
--           No launch list, so every service can be booked there. A booking still needs a vetted pro who covers the
--           ZIP (no pro -> waitlist, nothing charged). Booked ZIPs outside every area join "<State> - new areas"
--           automatically (lib/launch.ts addZipToServiceArea). Safe to run twice.
-- ============================================================================
insert into public.markets (name, state, zip_prefixes)
select v.name, v.state, v.zips from (values
  ('Flint & Tri-Cities', 'MI', array['484','485','486','487']),
  ('Lansing', 'MI', array['488','489']),
  ('Kalamazoo & Battle Creek', 'MI', array['490','491']),
  ('Jackson', 'MI', array['492']),
  ('Grand Rapids & West Michigan', 'MI', array['493','494','495']),
  ('Northern Michigan', 'MI', array['496','497']),
  ('Upper Peninsula', 'MI', array['498','499'])
) as v(name, state, zips)
where not exists (select 1 from public.markets m where m.name = v.name);


-- >>> migration 20261007060000_washington_service_areas.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261007060000_washington_service_areas.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-07_1700 UTC
-- PURPOSE : Washington service areas (Handled serves Michigan and Washington). No launch list -> every service bookable.
--             Seattle & Eastside        980, 981   (Seattle, Bellevue, Redmond, Kirkland, Renton, Kent, Auburn, Issaquah)
--             Everett & North Sound     982        (Everett, Lynnwood, Marysville, Mount Vernon, Bellingham)
--             Tacoma & South Sound      983, 984   (Tacoma, Puyallup, Lakewood, Federal Way area, Bremerton / Kitsap)
--             Olympia & Southwest WA    985, 986   (Olympia, Lacey, Tumwater, Centralia, Vancouver WA)
--             Central Washington        988, 989   (Wenatchee, Ellensburg, Yakima)
--             Spokane & Eastern WA      990-994    (Spokane, Spokane Valley, Tri-Cities, Walla Walla, Pullman)
--           A booking still needs a vetted pro who covers the ZIP (no pro -> waitlist, nothing charged). Safe to run twice.
-- ============================================================================
insert into public.markets (name, state, zip_prefixes)
select v.name, v.state, v.zips from (values
  ('Seattle & Eastside', 'WA', array['980','981']),
  ('Everett & North Sound', 'WA', array['982']),
  ('Tacoma & South Sound', 'WA', array['983','984']),
  ('Olympia & Southwest WA', 'WA', array['985','986']),
  ('Central Washington', 'WA', array['988','989']),
  ('Spokane & Eastern WA', 'WA', array['990','991','992','993','994'])
) as v(name, state, zips)
where not exists (select 1 from public.markets m where m.name = v.name);


-- >>> migration 20261007070000_washington_area_pricing.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261007070000_washington_area_pricing.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-07_1830 UTC
-- PURPOSE : Area pricing for Washington (markets.price_multiplier, read by lib/launch regionFactor -> estimate region):
--             Seattle area (Seattle & Eastside, Everett & North Sound, Tacoma & South Sound)  +25%  -> 1.25
--             Rest of Washington (Olympia & Southwest WA, Central Washington, Spokane & Eastern WA, new areas)  +20%  -> 1.20
--           Michigan stays 1.00. The pro's pay follows the price. Safe to run twice.
-- ============================================================================
update public.markets set price_multiplier = 1.25
 where state = 'WA' and name in ('Seattle & Eastside', 'Everett & North Sound', 'Tacoma & South Sound');
update public.markets set price_multiplier = 1.20
 where state = 'WA' and name not in ('Seattle & Eastside', 'Everett & North Sound', 'Tacoma & South Sound');


-- >>> migration 20261007080000_job_post_discovery.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261007080000_job_post_discovery.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-07_2030 UTC
-- PURPOSE : Automatic job-posting leads: businesses in Michigan and Washington hiring for work we do (cleaner, janitor,
--           porter, maintenance...) found daily through a licensed job-search API (Adzuna), then emailed the
--           "book it as a service instead of hiring" sequence.
--             * biz_leads.source adds 'job_board'; new columns state, posting_pay, posted_at
--             * biz_lead_settings.job_posts_per_day - searches per weekday (0 = off)
--           Safe to run twice.
-- ============================================================================
alter table public.biz_leads drop constraint if exists biz_leads_source_check;
alter table public.biz_leads add constraint biz_leads_source_check check (source in ('google_places','csv','manual','job_board'));
alter table public.biz_leads
  add column if not exists state text,
  add column if not exists posting_pay text check (posting_pay is null or length(posting_pay) <= 40),
  add column if not exists posted_at timestamptz;
create index if not exists biz_leads_company_idx on public.biz_leads (lower(business_name));
alter table public.biz_lead_settings add column if not exists job_posts_per_day int not null default 6 check (job_posts_per_day between 0 and 40);


-- >>> migration 20261009030000_handled_uplift.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261009030000_handled_uplift.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-09_0300 UTC
-- PURPOSE : Handled keeps 5 more points of every price, paid by customers (pro pay in dollars is unchanged).
--           Handled's share can now reach 40% (was 35%), so the guards move: a pro's payout may be as low as 60% of
--           the list price (was 65%); the services catalog's reporting share band becomes 0.60-0.85.
-- ============================================================================
alter table public.jobs drop constraint if exists jobs_take_rate_band;
alter table public.jobs add constraint jobs_take_rate_band check (
  contractor_payout is null or price_final is null or price_final = 0 or remedy is not null
  or amount_refunded > 0
  or (contractor_payout <= (price_final + coalesce(discount, 0) + coalesce(member_benefit, 0)) * 0.85
      and contractor_payout >= floor((price_final + coalesce(discount, 0) + coalesce(member_benefit, 0)) * 0.60) - 1)
) not valid;

alter table public.services drop constraint if exists services_payout_share_band;
alter table public.services add constraint services_payout_share_band check (payout_share between 0.60 and 0.85);


-- >>> seed.sql
-- ============================================================================
-- FILE    : supabase/seed.sql   (generated by scripts/gen-seed.ts - do not hand edit)
-- PROJECT : Handled - AI-run home & business services
-- CREATED : 2026-10-06_0740 UTC
-- PURPOSE : PRODUCTION seed - service catalog + launch market. Safe to re-run.
-- ============================================================================

insert into public.services (slug, name, category, minimum, payout_share, site_visit, sort) values
  ('house-cleaning', 'House & Office Cleaning', 'cleaning', 120, 0.787, false, 0),
  ('window-cleaning', 'Window Cleaning', 'cleaning', 149, 0.763, false, 1),
  ('carpet-cleaning', 'Carpet & Upholstery Cleaning', 'cleaning', 129, 0.795, false, 2),
  ('organizing', 'Organizing & Decluttering', 'cleaning', 199, 0.765, false, 3),
  ('gutter-cleaning', 'Gutter Cleaning', 'cleaning', 149, 0.792, false, 4),
  ('power-washing', 'Power Washing', 'cleaning', 149, 0.789, false, 5),
  ('mobile-car-detailing', 'Mobile Car Detailing', 'cleaning', 79, 0.788, false, 6),
  ('lawn-care', 'Lawn Care', 'outdoor', 55, 0.797, false, 7),
  ('tree-removal', 'Tree Removal & Trimming', 'outdoor', 250, 0.677, true, 8),
  ('leaf-removal', 'Leaf Removal', 'outdoor', 125, 0.768, false, 9),
  ('snow-removal', 'Snow Removal', 'outdoor', 40, 0.797, false, 10),
  ('dog-walking', 'Dog Walking', 'pets', 22, 0.799, false, 11),
  ('dog-sitting', 'Dog Sitting & Pet Watching', 'pets', 28, 0.797, false, 12),
  ('pet-waste-removal', 'Dog Poop Removal', 'pets', 20, 0.724, false, 13),
  ('junk-removal', 'Junk Removal', 'removal', 129, 0.772, false, 14),
  ('large-item-removal', 'Large Item Removal', 'removal', 99, 0.796, false, 15),
  ('junk-container', 'Junk Container (Drop-off & Pickup)', 'removal', 349, 0.727, false, 16),
  ('dead-animal-removal', 'Dead Animal Removal', 'removal', 129, 0.798, false, 17),
  ('waste-oil-collection', 'Used Oil Collection', 'removal', 95, 0.798, false, 18),
  ('small-moves', 'Small Moves & Moving Help', 'removal', 199, 0.675, false, 19),
  ('retail-delivery', 'Same-Day Large Item Delivery', 'removal', 89, 0.796, false, 20),
  ('staging-transport', 'Home Staging Furniture Moves', 'removal', 249, 0.677, false, 21),
  ('unit-turnover', 'Rental Unit Turnover', 'repair_remodel', 299, 0.7, false, 22),
  ('handyman', 'Handyman', 'repair_remodel', 99, 0.789, false, 23),
  ('plumbing', 'Plumbing Repairs', 'repair_remodel', 149, 0.788, false, 24),
  ('water-heater', 'Water Heater Replace & Repair', 'repair_remodel', 175, 0.847, false, 25),
  ('hvac-install', 'HVAC Installation', 'repair_remodel', 3500, 0.68, true, 26),
  ('lighting-install', 'Lighting & Ceiling Fan Install', 'repair_remodel', 149, 0.777, false, 27),
  ('camera-install', 'Security Camera Install', 'repair_remodel', 149, 0.749, false, 28),
  ('garbage-disposal', 'Garbage Disposal Repair & Replace', 'repair_remodel', 149, 0.747, false, 29),
  ('small-engine-repair', 'Small Engine Repair', 'repair_remodel', 69, 0.795, false, 30),
  ('dock-door-service', 'Loading Dock & Overhead Door Service', 'repair_remodel', 195, 0.771, false, 31),
  ('fire-extinguisher-inspection', 'Fire Extinguisher Inspection & Service', 'repair_remodel', 79, 0.8, false, 32),
  ('interior-painting', 'Interior Painting', 'repair_remodel', 349, 0.676, false, 33),
  ('exterior-painting', 'Exterior Painting', 'repair_remodel', 1200, 0.679, false, 34),
  ('foundation-repair', 'Foundation Repair', 'repair_remodel', 550, 0.678, true, 35),
  ('bathroom-remodel', 'Bathroom Remodel', 'repair_remodel', 3500, 0.68, true, 36),
  ('kitchen-remodel', 'Kitchen Remodel', 'repair_remodel', 12000, 0.68, true, 37),
  ('home-remodel', 'Whole-Home Remodel', 'repair_remodel', 25000, 0.68, true, 38),
  ('errands', 'Errands & Pickups', 'errands', 39, 0.789, false, 39),
  ('courier', 'Same-Day Courier', 'errands', 25, 0.744, false, 40),
  ('medical-delivery', 'Medical Deliveries', 'errands', 29, 0.727, false, 41),
  ('personal-assistant', 'Personal Assistant for the Day', 'errands', 120, 0.793, false, 42),
  ('private-driver', 'Private Driver / Black Car', 'transport', 170, 0.776, false, 43),
  ('urgent-ride', 'Urgent Ride (Non-Medical)', 'transport', 45, 0.791, false, 44),
  ('airport-transfer', 'Airport Transfer', 'transport', 95, 0.798, false, 45),
  ('limousine', 'Limousine', 'transport', 405, 0.693, false, 46),
  ('party-bus', 'Party Bus', 'transport', 900, 0.677, false, 47),
  ('charter-bus', 'Tour & Charter Bus', 'transport', 1100, 0.678, false, 48),
  ('game-day-rides', 'Game Day & Concert Rides', 'transport', 440, 0.677, false, 49),
  ('event-shuttle', 'Corporate & Event Shuttle', 'transport', 450, 0.675, false, 50),
  ('event-package', 'Plan My Event (by Budget)', 'events', 1000, 0.679, true, 51),
  ('event-planning', 'Event Planning & Coordination', 'events', 650, 0.679, true, 52),
  ('catering', 'Catering', 'events', 600, 0.678, false, 53),
  ('food-truck', 'Food Truck Booking', 'events', 1200, 0.678, false, 54),
  ('dj-music', 'DJ & Live Music', 'events', 450, 0.676, false, 55),
  ('event-security', 'Event Security', 'events', 220, 0.736, false, 56),
  ('security-guard', 'Security Guards & Patrol', 'security', 160, 0.767, false, 57),
  ('event-rentals', 'Seating & Party Rentals', 'events', 250, 0.711, false, 58),
  ('event-venue', 'Event Space Rental & Coordination', 'events', 800, 0.678, true, 59)
on conflict (slug) do update set name = excluded.name, category = excluded.category, minimum = excluded.minimum,
  payout_share = excluded.payout_share, site_visit = excluded.site_visit, sort = excluded.sort;

insert into public.markets (name, state, zip_prefixes)
select 'Metro Detroit', 'MI', array['480','481','482','483'] where not exists (select 1 from public.markets where name = 'Metro Detroit');


