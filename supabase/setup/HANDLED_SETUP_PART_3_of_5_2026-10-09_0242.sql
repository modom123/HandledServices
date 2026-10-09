-- ============================================================================
-- FILE    : supabase/setup/HANDLED_SETUP_PART_3_of_5_2026-10-09_0242.sql
-- PROJECT : Handled (myhumanai)
-- CREATED : 2026-10-09_0242 UTC
-- PURPOSE : NEW Supabase project setup, part 3 of 5 (run IN ORDER, one at a time). Migrations 20261003014600_market_pricing.sql .. 20261005041000_pro_rewards.sql.
--           Plain-ASCII (accented text uses U&'' escapes) so copy/paste can't corrupt it.
--           Supabase -> SQL Editor -> New query -> paste -> Run. Wait for "Success" before the next part.
-- ============================================================================
-- >>> migration 20261003014600_market_pricing.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261003014600_market_pricing.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
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
-- PROJECT : Handled (HandledServices) - AI-run home & business services
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
-- PROJECT : Handled (HandledServices) - AI-run home & business services
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
-- PROJECT : Handled (HandledServices) - AI-run home & business services
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
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-04_1949 UTC
-- PURPOSE : Grocery pickup & delivery is no longer offered (replaced by Same-Day Courier). Its catalog row
--           stays for any past jobs but is marked inactive; the new courier row is added by the catalog sync.
-- ============================================================================
update public.services set active = false where slug = 'grocery-delivery';


-- >>> migration 20261004220400_board_favorites.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261004220400_board_favorites.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
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


-- >>> migration 20261005012800_biz_job_posts.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261005012800_biz_job_posts.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-05_0130 UTC
-- PURPOSE : Business sales engine - job-posting track. A business that posted a job (Indeed and similar)
--           for a cleaner, handyman, maintenance tech, groundskeeper or mover is added by hand in the Hub
--           (job sites don't allow scraping) and gets the "book the work as a service" letter.
--             * biz_leads.job_title / posting_source / posting_url
--             * biz_leads.segment adds 'facilities' (offices, hotels & facilities)
-- ============================================================================
alter table public.biz_leads
  add column if not exists job_title text check (job_title is null or length(job_title) between 2 and 120),
  add column if not exists posting_source text check (posting_source is null or length(posting_source) <= 60),
  add column if not exists posting_url text check (posting_url is null or posting_url ~ '^https?://');
alter table public.biz_leads drop constraint if exists biz_leads_segment_check;
alter table public.biz_leads add constraint biz_leads_segment_check
  check (segment in ('property_manager','real_estate','stager','storage','retail','facilities'));


-- >>> migration 20261005014100_email_center.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261005014100_email_center.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-05_0148 UTC
-- PURPOSE : Email Center (Hub -> Email): marketing campaigns sent from the company mailbox
--           (Hostinger SMTP, info@handledsvc.com), a trickle send by the 10-minute cron, click tracking,
--           and the shared unsubscribe list (email_optouts).
--             * email_campaigns            - draft -> scheduled -> sending -> sent (or paused / cancelled)
--             * email_campaign_recipients  - one row per person per campaign (queued -> sent / failed / skipped)
--             * email_center_settings      - sender name, reply-to, daily cap, per-run pace
--             * marketing_sends.kind adds 'campaign' (one marketing email a week per person, across all)
-- ============================================================================
create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  subject text not null default '',
  preheader text,
  body text not null default '',
  subject_es text,
  body_es text,
  audience text not null check (audience in ('customers','repeat_customers','lapsed_customers','business_accounts','biz_leads','pros','custom')),
  custom_list text,
  custom_consent boolean not null default false,
  status text not null default 'draft' check (status in ('draft','scheduled','sending','sent','paused','cancelled')),
  scheduled_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  recipients int not null default 0,
  sent int not null default 0,
  failed int not null default 0,
  skipped int not null default 0,
  clicks int not null default 0,
  unsubscribes int not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.email_campaigns enable row level security;
create policy staff_all on public.email_campaigns for all to authenticated using (public.is_staff()) with check (public.is_staff());
create index if not exists email_campaigns_status_idx on public.email_campaigns (status, scheduled_at);

create table if not exists public.email_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.email_campaigns(id) on delete cascade,
  email text not null check (email = lower(email) and position('@' in email) > 1),
  name text,
  locale text not null default 'en' check (locale in ('en','es')),
  vars jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued','sent','failed','skipped')),
  error text,
  sent_at timestamptz,
  clicked_at timestamptz,
  clicks int not null default 0,
  unique (campaign_id, email)
);
alter table public.email_campaign_recipients enable row level security;
create policy staff_all on public.email_campaign_recipients for all to authenticated using (public.is_staff()) with check (public.is_staff());
create index if not exists email_recipients_queue_idx on public.email_campaign_recipients (campaign_id, status);

create table if not exists public.email_center_settings (
  id int primary key default 1 check (id = 1),
  from_name text not null default 'Handled',
  reply_to text,
  daily_cap int not null default 250 check (daily_cap between 1 and 1000),
  per_run int not null default 25 check (per_run between 1 and 60),
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.email_center_settings enable row level security;
create policy staff_all on public.email_center_settings for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.marketing_sends drop constraint if exists marketing_sends_kind_check;
alter table public.marketing_sends add constraint marketing_sends_kind_check
  check (kind in ('seasonal','quote_followup','booking_followup','campaign'));


-- >>> migration 20261005021600_job_checklists.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261005021600_job_checklists.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-05_0221 UTC
-- PURPOSE : Job checklists (packages/core/src/checklists.ts): one format for every service.
--             * jobs.checklist        - the checklist frozen when a pro takes the job (text can't change mid-job)
--             * jobs.checklist_extra  - special instructions added to one job (staff, or a customer request
--                                       before the work starts): [{ id, text, required, from, at }]
--             * job_checklist_checks  - each item done or N/A (with the reason), by whom and when. The pro on
--                                       the job and the customer can read them; writes go through the API.
-- ============================================================================
alter table public.jobs
  add column if not exists checklist jsonb,
  add column if not exists checklist_extra jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist_extra) = 'array');

create table if not exists public.job_checklist_checks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  item_id text not null check (length(item_id) between 3 and 80),
  status text not null check (status in ('done','na')),
  note text check (note is null or length(note) <= 500),
  checked_by text,
  checked_at timestamptz not null default now(),
  unique (job_id, item_id),
  check (status <> 'na' or (note is not null and length(trim(note)) >= 3))
);
alter table public.job_checklist_checks enable row level security;
create index if not exists job_checklist_checks_job_idx on public.job_checklist_checks (job_id);
create policy "pro reads own job checks" on public.job_checklist_checks for select to authenticated using (
  exists (select 1 from public.jobs j where j.id = job_id and j.contractor_id = public.my_contractor_id())
);
create policy "customer reads own job checks" on public.job_checklist_checks for select to authenticated using (
  exists (select 1 from public.jobs j where j.id = job_id and j.customer_id = auth.uid())
);
create policy staff_all on public.job_checklist_checks for all to authenticated using (public.is_staff()) with check (public.is_staff());


-- >>> migration 20261005024000_pro_interviews.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261005024000_pro_interviews.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-05_0246 UTC
-- PURPOSE : Pro screening interviews (packages/core/src/interview.ts) between application and invite.
--             * pro_interviews - one per interview: AI (the candidate chats from a private link, after an AI
--               disclosure and consent) or a person (in person / phone, scored in the Hub). Transcript, scores
--               with evidence, the computed result, and the staff decision. A person always decides.
--             * contractor_applications.stage adds 'interviewing' and 'interviewed'
-- ============================================================================
create table if not exists public.pro_interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.contractor_applications(id) on delete cascade,
  token text not null unique default substr(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 1, 32),
  mode text not null default 'ai' check (mode in ('ai','human')),
  locale text not null default 'en' check (locale in ('en','es')),
  status text not null default 'invited' check (status in ('invited','in_progress','completed','expired','cancelled','human_requested')),
  plan jsonb not null default '[]'::jsonb,
  transcript jsonb not null default '[]'::jsonb,
  scores jsonb,
  evaluation jsonb,
  result text check (result is null or result in ('advance','follow_up','not_now')),
  average numeric(3,1),
  interviewer text,
  consent_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days',
  decision text check (decision is null or decision in ('invite','follow_up','decline')),
  decided_by text,
  decided_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.pro_interviews enable row level security; -- candidates reach it only through the token API
create policy staff_all on public.pro_interviews for all to authenticated using (public.is_staff()) with check (public.is_staff());
create index if not exists pro_interviews_app_idx on public.pro_interviews (application_id, created_at desc);

alter table public.contractor_applications drop constraint if exists contractor_applications_stage_check;
alter table public.contractor_applications add constraint contractor_applications_stage_check
  check (stage in ('applied','screened','interviewing','interviewed','invited','rejected','withdrawn'));


-- >>> migration 20261005041000_pro_rewards.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261005041000_pro_rewards.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-05_0418 UTC
-- PURPOSE : Handled Pro Rewards (packages/core/src/rewards.ts) - loyalty points for independent pros.
--             * reward_settings     - earn rate, point value, pending days... (Hub -> Rewards)
--             * reward_ledger       - every point movement: earn (per job, pending -> available), milestone,
--                                     redeem (negative), return (cancelled order), adjust, expire, forfeit
--             * reward_catalog      - what points buy (gear, gift cards, tools, electronics, trips); starter items below
--             * reward_redemptions  - orders: requested -> approved -> ordered -> shipped -> delivered (or cancelled);
--                                     fair market value goes on the pro's 1099 for the year it's delivered
--             * reward_balances     - view: available and pending points per pro
--           Pros read their own ledger and orders; the catalog is readable by signed-in users; writes go through the API.
-- ============================================================================
create table if not exists public.reward_settings (
  id int primary key default 1 check (id = 1),
  settings jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.reward_settings enable row level security;
create policy staff_all on public.reward_settings for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.reward_ledger (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  kind text not null check (kind in ('earn','milestone','redeem','return','adjust','expire','forfeit')),
  points int not null,
  status text not null default 'available' check (status in ('pending','available','void')),
  job_id uuid references public.jobs(id) on delete set null,
  redemption_id uuid,
  milestone text,
  available_at timestamptz,
  detail jsonb,
  note text,
  created_by text not null default 'system',
  created_at timestamptz not null default now()
);
create unique index if not exists reward_ledger_job_uniq on public.reward_ledger (contractor_id, job_id) where kind = 'earn';
create unique index if not exists reward_ledger_milestone_uniq on public.reward_ledger (contractor_id, milestone) where kind = 'milestone';
create index if not exists reward_ledger_pro_idx on public.reward_ledger (contractor_id, created_at desc);
create index if not exists reward_ledger_pending_idx on public.reward_ledger (available_at) where status = 'pending';
alter table public.reward_ledger enable row level security;
create policy "pro reads own rewards" on public.reward_ledger for select to authenticated using (contractor_id = public.my_contractor_id());
create policy staff_all on public.reward_ledger for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.reward_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  name_es text,
  category text not null check (category in ('merch','gift_card','tools','electronics','travel','experience')),
  points int not null check (points > 0),
  cost_usd numeric(10,2) not null check (cost_usd >= 0),
  description text,
  description_es text,
  image_url text,
  stock int check (stock is null or stock >= 0),
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.reward_catalog enable row level security;
create policy "signed-in users read the catalog" on public.reward_catalog for select to authenticated using (active or public.is_staff());
create policy staff_all on public.reward_catalog for all to authenticated using (public.is_staff()) with check (public.is_staff());
insert into public.reward_catalog (slug, name, name_es, category, points, cost_usd, description, description_es, sort) values
  ('hat', 'Handled hat', 'Gorra Handled', 'merch', 2500, 25, 'Embroidered cap.', 'Gorra bordada.', 0),
  ('tee', 'Handled T-shirt', 'Camiseta Handled', 'merch', 2500, 25, 'Heavyweight cotton tee.', U&'Camiseta de algod\00F3n grueso.', 10),
  ('hoodie', 'Handled hoodie', 'Sudadera Handled', 'merch', 6000, 60, 'Warm pullover hoodie.', U&'Sudadera c\00E1lida con capucha.', 20),
  ('jacket', 'Handled work jacket', 'Chamarra de trabajo Handled', 'merch', 12000, 120, 'Insulated, water-resistant.', 'Aislada y resistente al agua.', 30),
  ('gas-50', '$50 gas card', 'Tarjeta de gasolina de $50', 'gift_card', 5000, 50, 'For the miles you drive.', 'Para las millas que maneja.', 40),
  ('tools-100', '$100 tool store gift card', U&'Tarjeta de regalo de $100 para ferreter\00EDa', 'gift_card', 10000, 100, 'Home-improvement store gift card.', 'Tarjeta de una tienda de mejoras para el hogar.', 50),
  ('drill-kit', 'Cordless drill & driver kit', U&'Kit de taladro y atornillador inal\00E1mbrico', 'tools', 20000, 200, 'Brushless, two batteries.', U&'Sin escobillas, dos bater\00EDas.', 60),
  ('earbuds', 'Wireless earbuds', U&'Aud\00EDfonos inal\00E1mbricos', 'electronics', 15000, 150, 'Noise-cancelling.', U&'Con cancelaci\00F3n de ruido.', 70),
  ('tv-55', '55" 4K TV', U&'Televisi\00F3n 4K de 55"', 'electronics', 45000, 450, 'Smart TV, delivered.', 'Smart TV, con entrega.', 80),
  ('tablet', 'Tablet', 'Tableta', 'electronics', 35000, 350, 'For quotes, photos and the app.', 'Para cotizaciones, fotos y la app.', 90),
  ('game-day', 'Detroit game-day tickets (2)', 'Boletos para un partido en Detroit (2)', 'experience', 30000, 300, 'Two tickets to a home game.', 'Dos boletos para un partido en casa.', 100),
  ('weekend-trip', 'Weekend getaway (2 nights)', 'Escapada de fin de semana (2 noches)', 'travel', 90000, 900, 'Hotel for two nights in Michigan or nearby.', 'Hotel por dos noches en Michigan o cerca.', 110),
  ('trip-for-two', '4-day trip for two', U&'Viaje de 4 d\00EDas para dos', 'travel', 200000, 2000, 'Flights and hotel, booked with you.', 'Vuelos y hotel, reservados con usted.', 120)
on conflict (slug) do nothing;

create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  item_id uuid references public.reward_catalog(id) on delete set null,
  item_name text not null,
  points int not null check (points > 0),
  fmv_usd numeric(10,2) not null check (fmv_usd >= 0),
  status text not null default 'requested' check (status in ('requested','approved','ordered','shipped','delivered','cancelled')),
  ship_to jsonb,
  tracking text,
  note text,
  delivered_at timestamptz,
  tax_year int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reward_redemptions_status_idx on public.reward_redemptions (status, created_at);
alter table public.reward_redemptions enable row level security;
create policy "pro reads own orders" on public.reward_redemptions for select to authenticated using (contractor_id = public.my_contractor_id());
create policy staff_all on public.reward_redemptions for all to authenticated using (public.is_staff()) with check (public.is_staff());

create or replace view public.reward_balances with (security_invoker = true) as
select contractor_id,
  coalesce(sum(points) filter (where status = 'available'), 0)::int as available,
  coalesce(sum(points) filter (where status = 'pending'), 0)::int as pending,
  coalesce(sum(points) filter (where kind in ('earn','milestone') and status <> 'void'), 0)::int as lifetime
from public.reward_ledger group by contractor_id;


