-- ============================================================================
-- FILE    : supabase/setup/HANDLED_SETUP_PART_3_of_5_2026-10-06_2045.sql
-- PROJECT : Handled (myhumanai)
-- CREATED : 2026-10-06_2045 UTC
-- PURPOSE : NEW Supabase project setup, part 3 of 5 (run IN ORDER, one at a time). Migrations 20261002223400_waitlist_google_reviews.sql .. 20261004220400_board_favorites.sql.
--           Plain-ASCII (accented text uses U&'' escapes) so copy/paste can't corrupt it.
--           Supabase -> SQL Editor -> New query -> paste -> Run. Wait for "Success" before the next part.
-- ============================================================================
-- >>> migration 20261002223400_waitlist_google_reviews.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261002223400_waitlist_google_reviews.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-02_2234 UTC
-- PURPOSE : Growth - finding customers and pros:
--             * waitlist - people who asked for a service where we have no pros yet; they're
--               told the day a pro starts covering their ZIP, and the counts drive recruiting
--               (Hub -> Supply gaps)
--             * reviews.google_clicked_at - customer tapped "Review us on Google" after rating
-- ============================================================================

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null check (position('@' in email) > 1),
  phone text,
  name text,
  zip text not null check (zip ~ '^[0-9]{5}$'),
  service_slug text not null,
  locale text not null default 'en' check (locale in ('en','es')),
  profile_id uuid references public.profiles(id) on delete set null,
  source text not null default 'booking',
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  unique (email, service_slug, zip)
);
alter table public.waitlist enable row level security; -- written and read by the server only
create index if not exists waitlist_open_idx on public.waitlist (service_slug, zip) where notified_at is null;

alter table public.reviews add column if not exists google_clicked_at timestamptz;


-- >>> migration 20261003001500_seasonal_quote_followups.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261003001500_seasonal_quote_followups.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-03_0015 UTC
-- PURPOSE : Bringing customers back:
--             * saved_quotes     - "Email me this price": the price, then follow-ups, with a link
--                                  that reopens the booking with their answers filled in
--             * marketing_sends  - every seasonal reminder / quote follow-up sent (never twice,
--                                  at most one seasonal email a month per person)
--             * email_optouts    - one-click unsubscribe from reminders (booking messages still go)
-- ============================================================================

create table if not exists public.saved_quotes (
  id uuid primary key default gen_random_uuid(),
  email text not null check (position('@' in email) > 1),
  service_slug text not null,
  answers jsonb not null default '{}',
  frequency text not null default 'once',
  price numeric(10,2),
  locale text not null default 'en' check (locale in ('en','es')),
  profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  followups_sent int not null default 0,
  last_followup_at timestamptz,
  booked_job_id uuid references public.jobs(id) on delete set null
);
alter table public.saved_quotes enable row level security; -- server only
create index if not exists saved_quotes_open_idx on public.saved_quotes (created_at) where booked_job_id is null;
create index if not exists saved_quotes_email_idx on public.saved_quotes (lower(email));

create table if not exists public.marketing_sends (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  kind text not null check (kind in ('seasonal','quote_followup','booking_followup')),
  key text not null,
  job_id uuid references public.jobs(id) on delete set null,
  sent_at timestamptz not null default now(),
  unique (email, kind, key)
);
alter table public.marketing_sends enable row level security;
create index if not exists marketing_sends_recent_idx on public.marketing_sends (lower(email), sent_at desc);

create table if not exists public.email_optouts (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table public.email_optouts enable row level security;


-- >>> migration 20261003003900_contract_records.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261003003900_contract_records.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-03_0039 UTC
-- PURPOSE : Every contract a customer, business or pro accepts - with a frozen copy of the exact
--           text they agreed to (sections + SHA-256 hash), when, how (booking, e-signature,
--           checkout), and from where. Shown in each person's account ("My contracts"), in the
--           pro portal, and in Hub -> Contract library. Kept after account deletion (legal record);
--           the profile link is cleared, the email stays.
-- ============================================================================

create table if not exists public.contract_acceptances (
  id uuid primary key default gen_random_uuid(),
  contract_key text not null,
  version text not null,
  title text not null,
  audience text not null check (audience in ('customer','business','pro')),
  profile_id uuid references public.profiles(id) on delete set null,
  contractor_id uuid references public.contractors(id) on delete set null,
  email text,
  signer_name text,
  job_id uuid references public.jobs(id) on delete set null,
  method text not null default 'click' check (method in ('booking','signature','checkout','click')),
  ip text,
  user_agent text,
  sections jsonb not null,
  content_hash text not null,
  accepted_at timestamptz not null default now()
);
alter table public.contract_acceptances enable row level security;
create index if not exists contract_acceptances_profile_idx on public.contract_acceptances (profile_id, accepted_at desc);
create index if not exists contract_acceptances_contractor_idx on public.contract_acceptances (contractor_id, accepted_at desc);
create index if not exists contract_acceptances_email_idx on public.contract_acceptances (lower(email));
create index if not exists contract_acceptances_key_idx on public.contract_acceptances (contract_key, version);

-- People read their own records (written by the server only).
create policy "own contracts" on public.contract_acceptances for select using (
  profile_id = auth.uid()
  or contractor_id in (select id from public.contractors where profile_id = auth.uid())
);


-- >>> migration 20261003004900_contract_language.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261003004900_contract_language.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-03_0049 UTC
-- PURPOSE : Contracts in Spanish: record the language each person read when they accepted.
--           The frozen copy (sections) also keeps the Spanish text they saw; English controls.
-- ============================================================================
alter table public.contract_acceptances
  add column if not exists locale text not null default 'en' check (locale in ('en','es'));


-- >>> migration 20261003011700_pro_fairness.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261003011700_pro_fairness.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-03_0117 UTC
-- PURPOSE : Make the system do what the Independent Contractor Agreement promises:
--             * pro_deductions        - a refund or lost chargeback charged to a pro is only a
--                                        PROPOSAL: written notice, 3 business days to respond, a
--                                        person decides; applied amounts never exceed half of a
--                                        weekly payout and never touch tips
--             * pro_standing_events   - late cancels, no-shows, warnings, suspensions,
--                                        deactivations, appeals and reinstatements, with reasons
--             * contractors.standing  - good / warned / suspended / deactivated (+ dates)
-- ============================================================================

create table if not exists public.pro_deductions (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  amount numeric(10,2) not null check (amount > 0),
  reason text not null,
  source text not null check (source in ('refund','chargeback')),
  status text not null default 'proposed' check (status in ('proposed','upheld','waived')),
  respond_by timestamptz not null,
  pro_response text,
  responded_at timestamptz,
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);
alter table public.pro_deductions enable row level security;
create index if not exists pro_deductions_open_idx on public.pro_deductions (status, respond_by);
create index if not exists pro_deductions_pro_idx on public.pro_deductions (contractor_id, created_at desc);
create policy "pro reads own deductions" on public.pro_deductions for select using (
  contractor_id in (select id from public.contractors where profile_id = auth.uid())
);

create table if not exists public.pro_standing_events (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  kind text not null check (kind in ('late_cancel','no_show','warning','suspension','deactivation','appeal','appeal_upheld','reinstated','note')),
  job_id uuid references public.jobs(id) on delete set null,
  note text,
  actor text,
  created_at timestamptz not null default now()
);
alter table public.pro_standing_events enable row level security;
create index if not exists pro_standing_pro_idx on public.pro_standing_events (contractor_id, created_at desc);
create policy "pro reads own standing" on public.pro_standing_events for select using (
  contractor_id in (select id from public.contractors where profile_id = auth.uid())
);

alter table public.contractors
  add column if not exists standing text not null default 'good' check (standing in ('good','warned','suspended','deactivated')),
  add column if not exists standing_reason text,
  add column if not exists warned_at timestamptz,
  add column if not exists improve_by date,
  add column if not exists appeal_by date,
  add column if not exists appeal_decide_by date,
  add column if not exists background_recheck_due date;

-- Payout rows can be held for a deduction decision; a deduction's applied piece is recorded as a clawback row.
alter table public.payouts add column if not exists deduction_id uuid references public.pro_deductions(id) on delete set null;


-- >>> migration 20261003014600_market_pricing.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261003014600_market_pricing.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-03_0146 UTC
-- PURPOSE : Market pricing - the market sets the price, inside guardrails:
--             * jobs.suggested_price / customer_offer - our suggestion vs. what the customer offered
--             * job_offers counter - a pro can say "I'll do it for $X" (status 'countered');
--               the customer accepts (pays the difference) or not
--             * price_signals    - every accept / decline / counter / expiry vs. the suggestion
--             * market_factors   - what we learned per service (and ZIP area): the suggested price
--                                  moves toward what pros actually accept, bounded 0.85-1.30x,
--                                  with a manual override in Hub -> Market pricing
-- ============================================================================
alter type offer_status add value if not exists 'countered';

alter table public.job_offers
  add column if not exists counter_payout numeric(10,2),
  add column if not exists counter_price numeric(10,2),
  add column if not exists counter_note text,
  add column if not exists countered_at timestamptz;

alter table public.jobs
  add column if not exists suggested_price numeric(10,2),
  add column if not exists customer_offer numeric(10,2),
  add column if not exists booking_fee numeric(10,2) not null default 0,
  add column if not exists offer_nudged_at timestamptz,
  add column if not exists pending_counter_offer uuid references public.job_offers(id) on delete set null,
  add column if not exists pending_raise numeric(10,2);

create table if not exists public.price_signals (
  id uuid primary key default gen_random_uuid(),
  service_slug text not null,
  area text not null,               -- first 3 digits of the ZIP
  price numeric(10,2) not null,
  suggested numeric(10,2) not null,
  outcome text not null check (outcome in ('accepted','declined','countered','expired')),
  counter numeric(10,2),
  job_id uuid references public.jobs(id) on delete set null,
  contractor_id uuid references public.contractors(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.price_signals enable row level security;
create index if not exists price_signals_lookup_idx on public.price_signals (service_slug, area, created_at desc);

create table if not exists public.market_factors (
  service_slug text not null,
  area text not null default 'all',
  factor numeric(4,2) not null default 1 check (factor between 0.5 and 2),
  samples int not null default 0,
  target numeric(5,2),
  manual_factor numeric(4,2) check (manual_factor is null or manual_factor between 0.5 and 2),
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (service_slug, area)
);
alter table public.market_factors enable row level security;
create policy "market factors are public" on public.market_factors for select using (true);

-- Raising an offer / accepting a counter is its own payment kind.
alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check
  check (kind in ('deposit','final','milestone','plan','upfront','refund','balance','change_order','offer_raise','custom','materials','tip','gift_card','membership'));


-- >>> migration 20261003020600_pro_lead_engine.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261003020600_pro_lead_engine.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-03_0206 UTC
-- PURPOSE : Pro lead engine - find independent pros automatically and invite them:
--             * pro_leads         - businesses found (Google Places, CSV import of license lists)
--                                   with trade, area, rating, score, contact, outreach state
--             * pro_lead_events   - every email, click, call, reply, unsubscribe, conversion
--             * lead_engine_settings - one row: on/off, daily caps, trades, sequence timing
--           Email only (with unsubscribe and our postal address); phone-only leads go to a
--           human call list - never automated texts.
-- ============================================================================

create table if not exists public.pro_leads (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 18),
  source text not null check (source in ('google_places','csv','manual')),
  external_id text,                          -- Google place_id, license number...
  business_name text not null,
  contact_name text,
  trade text not null,
  area text,                                 -- ZIP3 or city
  zip text,
  city text,
  phone text,
  email text,
  website text,
  rating numeric(2,1),
  review_count int,
  license_number text,
  score int not null default 0,
  status text not null default 'new' check (status in ('new','queued','emailing','clicked','replied','applied','call','not_interested','unsubscribed','bounced','do_not_contact')),
  step int not null default 0,              -- emails sent so far
  next_send_at timestamptz,
  last_contact_at timestamptz,
  application_id uuid references public.contractor_applications(id) on delete set null,
  details_expire_at timestamptz,             -- Google content is refreshed/cleared after 30 days (their terms)
  notes text,
  created_at timestamptz not null default now(),
  unique (source, external_id)
);
alter table public.pro_leads enable row level security; -- server / staff only
create index if not exists pro_leads_due_idx on public.pro_leads (status, next_send_at);
create index if not exists pro_leads_email_idx on public.pro_leads (lower(email));
create index if not exists pro_leads_trade_idx on public.pro_leads (trade, area);

create table if not exists public.pro_lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.pro_leads(id) on delete cascade,
  kind text not null,
  note text,
  actor text,
  created_at timestamptz not null default now()
);
alter table public.pro_lead_events enable row level security;
create index if not exists pro_lead_events_lead_idx on public.pro_lead_events (lead_id, created_at desc);

create table if not exists public.lead_engine_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  discover_per_day int not null default 10,  -- Places searches per day (trade x area)
  emails_per_day int not null default 40,
  min_rating numeric(2,1) not null default 4.3,
  min_reviews int not null default 5,
  trades text[] not null default '{}',       -- empty = all trades with a supply gap
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.lead_engine_settings enable row level security;
insert into public.lead_engine_settings (id) values (1) on conflict do nothing;

alter table public.contractor_applications add column if not exists lead_id uuid references public.pro_leads(id) on delete set null;


-- >>> migration 20261003130300_crews_fast_track.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261003130300_crews_fast_track.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-03_1303 UTC
-- PURPOSE : Crew accounts and the proven-skill fast track.
--             * crew_members      - people a pro company sends to jobs (helpers, apprentices,
--                                   licensed techs). Each one who enters a customer's home passes
--                                   our background check first (Pro Agreement: helpers). The
--                                   company pays and directs them and handles their work
--                                   authorization, payroll and workers' comp (Crew Addendum).
--             * jobs.crew_member_id - who the company is sending (shown to the customer)
--             * contractors.crew_* - the owner's crew attestation (signed with the Crew Addendum)
--             * contractors.fast_track_* / tier_floor - a master of their trade sends a portfolio,
--                                   does one paid trial job we review, and starts at Pro+
-- ============================================================================

create table if not exists public.crew_members (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  full_name text not null check (length(full_name) between 2 and 120),
  phone text,
  email text,
  locale text not null default 'en' check (locale in ('en','es')),
  role text not null default 'helper' check (role in ('lead','helper','apprentice','licensed')),
  trades text[] not null default '{}',
  years_experience int check (years_experience is null or years_experience between 0 and 70),
  license_number text,
  background_status text not null default 'not_started' check (background_status in ('not_started','invited','pending','clear','consider','suspended','canceled')),
  background_provider_id text,
  background_checked_at timestamptz,
  active boolean not null default true,
  removed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.crew_members enable row level security;
create index if not exists crew_members_pro_idx on public.crew_members (contractor_id) where active;
create index if not exists crew_members_checkr_idx on public.crew_members (background_provider_id) where background_provider_id is not null;
create policy "pro reads own crew" on public.crew_members for select using (
  contractor_id in (select id from public.contractors where profile_id = auth.uid())
);
create policy staff_all on public.crew_members for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.jobs
  add column if not exists crew_member_id uuid references public.crew_members(id) on delete set null;

alter table public.contractors
  add column if not exists crew_attested_at timestamptz,
  add column if not exists crew_attestation jsonb,
  add column if not exists fast_track_status text not null default 'none'
    check (fast_track_status in ('none','applied','trial','approved','declined')),
  add column if not exists fast_track jsonb,
  add column if not exists fast_track_applied_at timestamptz,
  add column if not exists fast_track_trial_job_id uuid references public.jobs(id) on delete set null,
  add column if not exists fast_track_decided_at timestamptz,
  add column if not exists fast_track_decided_by text,
  add column if not exists fast_track_note text,
  add column if not exists tier_floor text check (tier_floor is null or tier_floor in ('pro_plus'));


-- >>> migration 20261004193200_business_growth.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261004193200_business_growth.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-04_1932 UTC
-- PURPOSE : The growth plan's missing pieces:
--             * markets.launch_services   - constraint-driven launch: only these services are bookable in
--                                           the city (null = all); others show "coming soon" + waitlist
--             * business accounts         - billing (prepay by default; invoicing on terms approved case by
--                                           case with a credit limit and a reason; automatic hold when an
--                                           invoice is 10+ days overdue), priority dispatch, pilot offer,
--                                           members (logins), properties, dedicated pros, monthly invoices
--             * jobs.business_*           - account bookings: property, billed on the account's invoice
--             * biz_leads (+ events, settings) - the business sales engine (property managers, brokerages,
--                                           stagers, self-storage, stores)
--             * contractors.id_verified_at - photo ID matched to a selfie (Stripe Identity) or a staff video call
-- ============================================================================

-- -- Launch set per city -----------------------------------------------------
alter table public.markets add column if not exists launch_services text[];

-- -- Business accounts -------------------------------------------------------
alter table public.business_accounts
  add column if not exists billing_mode text not null default 'prepay' check (billing_mode in ('prepay','terms')),
  add column if not exists terms_days int not null default 30 check (terms_days in (15,30,45)),
  add column if not exists credit_limit numeric(12,2) not null default 0 check (credit_limit >= 0),
  add column if not exists terms_hold boolean not null default false,
  add column if not exists terms_approved_by text,
  add column if not exists terms_approved_at timestamptz,
  add column if not exists terms_note text,
  add column if not exists terms_requested_at timestamptz,
  add column if not exists priority boolean not null default false,
  add column if not exists pilot_discount_pct int not null default 0 check (pilot_discount_pct between 0 and 30),
  add column if not exists pilot_jobs_left int not null default 0 check (pilot_jobs_left between 0 and 5),
  add column if not exists billing_email text,
  add column if not exists industry text,
  add column if not exists source_lead_id uuid;
comment on column public.business_accounts.billing_terms is 'Legacy (unused): see billing_mode / terms_days. Every account starts on prepay.';

create table if not exists public.business_members (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.business_accounts(id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  profile_id uuid references public.profiles(id) on delete set null,
  role text not null default 'booker' check (role in ('admin','booker')),
  created_at timestamptz not null default now(),
  unique (account_id, email)
);
create index if not exists business_members_profile_idx on public.business_members (profile_id);
create index if not exists business_members_email_idx on public.business_members (email);

create table if not exists public.business_properties (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.business_accounts(id) on delete cascade,
  name text not null,
  address text not null,
  city text not null,
  state text not null,
  zip text not null check (zip ~ '^\d{5}$'),
  units int check (units is null or units >= 0),
  access_notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists business_properties_account_idx on public.business_properties (account_id);

create table if not exists public.business_pros (
  account_id uuid not null references public.business_accounts(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  added_by text,
  created_at timestamptz not null default now(),
  primary key (account_id, contractor_id)
);

create table if not exists public.business_invoices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.business_accounts(id) on delete cascade,
  number text not null unique,
  period_start date not null,
  period_end date not null,
  issued_on date not null,
  due_date date not null,
  total numeric(12,2) not null check (total >= 0),
  amount_paid numeric(12,2) not null default 0,
  status text not null default 'open' check (status in ('open','paid','void')),
  paid_at timestamptz,
  payment_url text,
  reminders_sent int not null default 0,
  last_reminder_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists business_invoices_open_idx on public.business_invoices (status, due_date);

alter table public.jobs
  add column if not exists business_property_id uuid references public.business_properties(id) on delete set null,
  add column if not exists billed_on_terms boolean not null default false,
  add column if not exists business_invoice_id uuid references public.business_invoices(id) on delete set null;
create index if not exists jobs_business_idx on public.jobs (business_account_id) where business_account_id is not null;
create index if not exists jobs_terms_uninvoiced_idx on public.jobs (business_account_id) where billed_on_terms and business_invoice_id is null;

alter table public.payments add column if not exists business_invoice_id uuid references public.business_invoices(id) on delete set null;
alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check
  check (kind in ('deposit','final','milestone','plan','upfront','refund','balance','change_order','offer_raise','custom','materials','tip','gift_card','membership','invoice'));

-- dedicated pros get a first-look offer on their account's jobs
alter table public.job_offers drop constraint if exists job_offers_kind_check;
alter table public.job_offers add constraint job_offers_kind_check check (kind in ('job','recurring','redo','account'));

-- RLS: staff everything; members read their own accounts (portal pages use the server with membership checks)
alter table public.business_members enable row level security;
alter table public.business_properties enable row level security;
alter table public.business_pros enable row level security;
alter table public.business_invoices enable row level security;
create policy staff_all on public.business_members for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.business_properties for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.business_pros for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.business_invoices for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "members read own membership" on public.business_members for select using (profile_id = auth.uid());
create policy "members read own properties" on public.business_properties for select using (
  account_id in (select account_id from public.business_members where profile_id = auth.uid()));
create policy "members read own invoices" on public.business_invoices for select using (
  account_id in (select account_id from public.business_members where profile_id = auth.uid()));
create policy "members read own account" on public.business_accounts for select using (
  id in (select account_id from public.business_members where profile_id = auth.uid()));

-- -- Business sales engine ---------------------------------------------------
create table if not exists public.biz_leads (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 18),
  source text not null check (source in ('google_places','csv','manual')),
  external_id text,
  business_name text not null,
  segment text not null check (segment in ('property_manager','real_estate','stager','storage','retail')),
  contact_name text,
  city text,
  zip text,
  phone text,
  email text,
  website text,
  rating numeric(2,1),
  review_count int,
  score int not null default 0,
  status text not null default 'new' check (status in ('new','queued','emailing','clicked','replied','converted','call','not_interested','unsubscribed','bounced','do_not_contact')),
  account_id uuid references public.business_accounts(id) on delete set null,
  last_contact_at timestamptz,
  details_expire_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (source, external_id)
);
alter table public.biz_leads enable row level security; -- server / staff only
create index if not exists biz_leads_status_idx on public.biz_leads (status, score desc);
create index if not exists biz_leads_email_idx on public.biz_leads (lower(email));

create table if not exists public.biz_lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.biz_leads(id) on delete cascade,
  kind text not null,
  note text,
  actor text,
  created_at timestamptz not null default now()
);
alter table public.biz_lead_events enable row level security;

create table if not exists public.biz_lead_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  discover_per_day int not null default 5,
  emails_per_day int not null default 20,
  segments text[] not null default '{property_manager,real_estate,stager,storage}',
  pilot_pct int not null default 20 check (pilot_pct between 0 and 30),
  pilot_jobs int not null default 2 check (pilot_jobs between 0 and 5),
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.biz_lead_settings enable row level security;
insert into public.biz_lead_settings (id) values (1) on conflict do nothing;

alter table public.business_accounts drop constraint if exists business_accounts_source_lead_fk;
alter table public.business_accounts add constraint business_accounts_source_lead_fk foreign key (source_lead_id) references public.biz_leads(id) on delete set null;

-- -- Pro photo ID verification -----------------------------------------------
alter table public.contractors
  add column if not exists id_verified_at timestamptz,
  add column if not exists id_verification jsonb;
-- pros already approved before this step existed keep working (verified by the earlier process)
update public.contractors set id_verified_at = coalesce(background_checked_at, onboarded_at, now()), id_verification = '{"provider":"grandfathered"}'
  where status = 'approved' and id_verified_at is null;


-- >>> migration 20261004194900_retire_grocery.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261004194900_retire_grocery.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-04_1949 UTC
-- PURPOSE : Grocery pickup & delivery is no longer offered (replaced by Same-Day Courier). Its catalog row
--           stays for any past jobs but is marked inactive; the new courier row is added by the catalog sync.
-- ============================================================================
update public.services set active = false where slug = 'grocery-delivery';


-- >>> migration 20261004220400_board_favorites.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261004220400_board_favorites.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-04_2204 UTC
-- PURPOSE : Open job board, customer favorites and crew member requests (packages/core/src/board.ts).
--             * job_offers.kind adds 'favorite' (a customer's favorite pro gets a first look) and
--               'board' (a pro claimed the job from "Jobs near you"; held while they read the work order)
--             * customer_favorites - any customer can favorite a pro, or a crew member of a pro company
--             * jobs.preferred_contractor_id / requested_crew_member_id - "Book again with ...": the pro
--               gets a first look (never guaranteed); a crew member request goes to the company owner,
--               who decides who goes
--             * job_crew(job) - the customer's safe view of the crew member assigned to their job
-- ============================================================================

alter table public.job_offers drop constraint if exists job_offers_kind_check;
alter table public.job_offers add constraint job_offers_kind_check
  check (kind in ('job','recurring','redo','account','favorite','board'));

create table if not exists public.customer_favorites (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  crew_member_id uuid references public.crew_members(id) on delete cascade,
  service_slug text,
  created_at timestamptz not null default now()
);
create unique index if not exists customer_favorites_uniq
  on public.customer_favorites (customer_id, contractor_id, coalesce(crew_member_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists customer_favorites_pro_idx on public.customer_favorites (contractor_id);
alter table public.customer_favorites enable row level security;
create policy "customer reads own favorites" on public.customer_favorites for select to authenticated using (customer_id = auth.uid());
create policy "customer removes own favorites" on public.customer_favorites for delete to authenticated using (customer_id = auth.uid());
create policy staff_all on public.customer_favorites for all to authenticated using (public.is_staff()) with check (public.is_staff());
-- adding a favorite goes through the API (checks the customer actually had that pro)

alter table public.jobs
  add column if not exists preferred_contractor_id uuid references public.contractors(id) on delete set null,
  add column if not exists requested_crew_member_id uuid references public.crew_members(id) on delete set null;

-- Who from the company is coming? First name and role only - for the customer on that job.
create or replace function public.job_crew(p_job uuid)
returns table (crew_member_id uuid, first_name text, role text)
language sql stable security definer set search_path = public as $$
  select m.id, split_part(m.full_name, ' ', 1), m.role
  from public.jobs j join public.crew_members m on m.id = j.crew_member_id
  where j.id = p_job and (j.customer_id = auth.uid() or public.is_staff())
$$;
grant execute on function public.job_crew(uuid) to authenticated;


