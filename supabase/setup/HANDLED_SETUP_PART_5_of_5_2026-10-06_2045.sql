-- ============================================================================
-- FILE    : supabase/setup/HANDLED_SETUP_PART_5_of_5_2026-10-06_2045.sql
-- PROJECT : Handled (myhumanai)
-- CREATED : 2026-10-06_2045 UTC
-- PURPOSE : NEW Supabase project setup, part 5 of 5 (run IN ORDER, one at a time). Migrations 20261005203900_bid_archive.sql .. 20261006201000_pro_business_address.sql.
--           Plain-ASCII (accented text uses U&'' escapes) so copy/paste can't corrupt it.
--           Supabase -> SQL Editor -> New query -> paste -> Run. Wait for "Success" before the next part.
--           LAST PART. When it succeeds: sign in once on the website, then run (with your email):
--             update public.profiles set role = 'admin' where email = 'YOU@YOURCOMPANY.COM';
-- ============================================================================
-- >>> migration 20261005203900_bid_archive.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261005203900_bid_archive.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-05_2043 UTC
-- PURPOSE : RFP / RFQ archive and resubmission (bid engine, Hub -> Bids).
--             * bids: solicitation type (RFQ, RFP, IFB...), revision number, reopened for a revision (when / why),
--               and the earlier bid it was copied from (next year's re-bid)
--             * bid_documents: versions - replacing a file keeps the old one (superseded, never deleted)
--             * bid_submissions: every time a bid is submitted, a frozen record: number, reason, what changed, the
--               exact pricing, compliance matrix, review sign-off and the documents sent, plus the confirmation
-- ============================================================================
alter table public.bids add column if not exists solicitation_type text not null default 'rfq'
  check (solicitation_type in ('rfq','rfp','ifb','rfi','sources_sought','other'));
alter table public.bids add column if not exists revision int not null default 0;
alter table public.bids add column if not exists reopened_at timestamptz;
alter table public.bids add column if not exists reopen_reason text;
alter table public.bids add column if not exists reopen_note text;
alter table public.bids add column if not exists previous_bid_id uuid references public.bids(id) on delete set null;
create index if not exists bids_search on public.bids (solicitation_type, status, created_at desc);

alter table public.bid_documents add column if not exists version int not null default 1;
alter table public.bid_documents add column if not exists superseded_at timestamptz;
alter table public.bid_documents add column if not exists superseded_by uuid references public.bid_documents(id) on delete set null;
alter table public.bid_documents add column if not exists note text;

create table if not exists public.bid_submissions (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid not null references public.bids(id) on delete cascade,
  number int not null check (number >= 1),
  reason text not null default 'initial' check (reason in ('initial','correction','addendum','agency_request','bafo','price_update')),
  change_note text,
  submitted_at timestamptz not null default now(),
  submitted_by text not null,
  our_price numeric,
  snapshot jsonb not null,
  document_ids uuid[] not null default '{}',
  confirmation_doc_id uuid references public.bid_documents(id) on delete restrict,
  unique (bid_id, number)
);
alter table public.bid_submissions enable row level security;
create policy staff_all on public.bid_submissions for all to authenticated using (public.is_staff()) with check (public.is_staff());
-- a submission record is evidence: it can't be edited after the fact
create or replace function public.bid_submission_frozen() returns trigger language plpgsql as $$
begin raise exception 'Submission records are permanent - submit a new version instead'; end $$;
drop trigger if exists bid_submission_frozen on public.bid_submissions;
create trigger bid_submission_frozen before update on public.bid_submissions for each row execute function public.bid_submission_frozen();


-- >>> migration 20261005213400_biz_lead_partners.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261005213400_biz_lead_partners.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-05_2134 UTC
-- PURPOSE : Business leads can be teaming partners (segment 'partner'): firms we bid public contracts with.
--           Tracked in Hub -> Business leads, never discovered, emailed by the sales sequence or included in
--           Email Center blasts (enforced in lib/biz-leads.ts and lib/email-center.ts).
-- ============================================================================
alter table public.biz_leads drop constraint if exists biz_leads_segment_check;
alter table public.biz_leads add constraint biz_leads_segment_check
  check (segment in ('property_manager','real_estate','stager','storage','retail','facilities','partner'));


-- >>> migration 20261005213900_account_notes.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261005213900_account_notes.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-05_2141 UTC
-- PURPOSE : Account notes - the running conversation history for every business lead, business account and
--           Handled Talent client: notes, calls, emails, meetings and texts, each with who wrote it and when.
--           Append-only: a note is never edited or deleted (the database refuses), so the history stays complete;
--           a correction is a new note. Status changes and automated events stay in biz_lead_events and are shown
--           in the same timeline.
-- ============================================================================
create table if not exists public.account_notes (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('biz_lead','business_account','talent_client')),
  subject_id uuid not null,
  kind text not null default 'note' check (kind in ('note','call','email','meeting','text','status')),
  body text not null check (length(trim(body)) between 1 and 8000),
  author text not null,
  created_at timestamptz not null default now()
);
create index if not exists account_notes_subject on public.account_notes (subject_type, subject_id, created_at desc);
alter table public.account_notes enable row level security;
create policy staff_read on public.account_notes for select to authenticated using (public.is_staff());
create policy staff_add on public.account_notes for insert to authenticated with check (public.is_staff());

create or replace function public.account_notes_append_only() returns trigger language plpgsql as $$
begin raise exception 'Account notes are permanent - add a new note instead of changing or deleting one'; end $$;
drop trigger if exists account_notes_append_only on public.account_notes;
create trigger account_notes_append_only before update or delete on public.account_notes for each row execute function public.account_notes_append_only();

-- keep what's already written: each lead's existing notes become its first history entry
insert into public.account_notes (subject_type, subject_id, kind, body, author, created_at)
select 'biz_lead', l.id, 'note', l.notes, 'imported', l.created_at
from public.biz_leads l
where l.notes is not null and length(trim(l.notes)) > 0
  and not exists (select 1 from public.account_notes n where n.subject_type = 'biz_lead' and n.subject_id = l.id);


-- >>> migration 20261005214500_customer_notes.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261005214500_customer_notes.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-05_2146 UTC
-- PURPOSE : Customer notes - the same permanent, append-only history now covers homeowner / walk-in customers.
--           A customer is keyed by their email: subject_id = md5(lower(trim(email)))::uuid, so every booking
--           under that email shares one history (the app computes the same id).
-- ============================================================================
alter table public.account_notes drop constraint if exists account_notes_subject_type_check;
alter table public.account_notes add constraint account_notes_subject_type_check
  check (subject_type in ('biz_lead','business_account','talent_client','customer'));

create or replace function public.customer_subject_id(email text) returns uuid language sql immutable as $$
  select md5(lower(trim(email)))::uuid
$$;


-- >>> migration 20261006032400_factoring_partners.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261006032400_factoring_partners.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-06_0324 UTC
-- PURPOSE : Invoice factoring partners (packages/core/src/factoring.ts, Hub -> Factoring): the companies we're asking
--           to fund net-30+ business, city and government invoices so weekly pro payouts stay on time. One row per
--           partner with the outreach status and the quote (advance rate, fee, recourse, minimums, term, fees).
--           Seeded with the five partners from docs/FACTORING_COMPARISON_2026-10-06_0320.xlsx (web search, verify on
--           the call). Staff only. No contract or bank details are stored here.
-- ============================================================================
create table if not exists public.factoring_partners (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  website text,
  fit text,
  sort int not null default 100,
  status text not null default 'to_contact'
    check (status in ('to_contact','emailed','call_scheduled','quote_received','applied','active','passed')),
  gov_scope text,                                   -- which receivables they fund: federal / state / city
  advance_rate numeric check (advance_rate is null or (advance_rate > 0 and advance_rate <= 1)),
  fee_pct numeric check (fee_pct is null or (fee_pct >= 0 and fee_pct < 1)),
  fee_period_days int check (fee_period_days is null or fee_period_days between 1 and 90),
  days_to_fund int check (days_to_fund is null or days_to_fund between 0 and 60),
  recourse text check (recourse is null or recourse in ('recourse','non_recourse')),
  monthly_minimum numeric check (monthly_minimum is null or monthly_minimum >= 0),
  term text,                                        -- contract length / auto-renew / early-exit fee
  spot_factoring boolean,
  other_fees text,
  contact_name text,
  contact_email text,
  contact_phone text,
  contacted_at date,
  notes text,
  updated_by text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.factoring_partners enable row level security;
create policy staff_all on public.factoring_partners for all to authenticated using (public.is_staff()) with check (public.is_staff());

insert into public.factoring_partners (slug, name, website, fit, sort) values
  ('advance-partners', 'Advance Partners', 'https://www.advancepartners.com/payroll-funding/government-staffing/',
   'Payroll funding for staffing on government contracts, including municipal; back office for payroll and billing. Best fit for the weekly pro payout run.', 10),
  ('1st-commercial-credit', '1st Commercial Credit', 'https://www.1stcommercialcredit.com/financial-services/government-receivables',
   'Dedicated government-receivables program plus staffing and payroll funding; works with small businesses.', 20),
  ('porter-capital', 'Porter Capital', 'https://portercap.com/government-invoice-factoring',
   'Long-time government contractor factoring; covers service and staffing businesses.', 30),
  ('ecapital', 'eCapital', 'https://ecapital.com/blog/using-government-contractor-financing-to-bridge-cash-flow-gaps',
   'Large lender with government contractor financing; can grow into an asset-based credit line for bigger contracts.', 40),
  ('8a-factoring', '8A Factoring', 'https://www.8afactoring.com',
   'Government invoices for small and 8(a) / minority-owned businesses; fits set-aside and MBE/DBE work.', 50)
on conflict (slug) do nothing;


-- >>> migration 20261006070800_app_payments.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261006070800_app_payments.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-06_0708 UTC
-- PURPOSE : In-app payments (Apple Pay, Google Pay, card via Stripe PaymentSheet): a payment row
--           remembers its PaymentIntent, so the webhook can settle it and support can look it up.
-- ============================================================================
alter table public.payments add column if not exists stripe_payment_intent_id text;
create index if not exists payments_stripe_payment_intent_idx on public.payments (stripe_payment_intent_id) where stripe_payment_intent_id is not null;


-- >>> migration 20261006072600_lock_down_rpc.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261006072600_lock_down_rpc.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-06_0726 UTC
-- PURPOSE : Security (defense in depth): functions that run with elevated rights (security definer) are
--           not callable from the app unless they're meant to be. Supabase exposes the public schema as
--           RPC, so an un-revoked function can be called with the public (anon) key.
--             * recompute_contractor_rating(cid) - was callable by anyone (it only recomputes from existing
--               reviews, so harmless, but it isn't the app's business). Now server-only.
--             * draw_promo_balance(code, amount) - already revoked in launch_growth; re-asserted here and
--               granted explicitly to the server (service_role) so it can't be lost by accident.
--           Helpers that only answer about the caller (is_staff, app_role, my_contractor_id) and the
--           customer's own-job lookups (job_pro, job_crew) stay callable by signed-in users.
--           New functions in this schema are no longer executable by anonymous users by default.
-- ============================================================================
revoke all on function public.draw_promo_balance(text, numeric) from public, anon, authenticated;
grant execute on function public.draw_promo_balance(text, numeric) to service_role;

revoke all on function public.recompute_contractor_rating(uuid) from public, anon, authenticated;
grant execute on function public.recompute_contractor_rating(uuid) to service_role;

alter default privileges in schema public revoke execute on functions from public, anon;


-- >>> migration 20261006075200_agent_tasks.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261006075200_agent_tasks.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-06_0752 UTC
-- PURPOSE : Tasks the team assigns to the AI agents (Hub -> AI agents, or by asking the Ops co-pilot).
--           Each open task is added to that agent's instructions on every run (packages/core/src/mission.ts),
--           and the morning brief reports progress on all of them. agent = the agent's kind
--           (concierge, dispatch, daily_brief...) or 'all' for every agent. Staff only.
-- ============================================================================
create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  agent text not null check (agent ~ '^[a-z_]{2,40}$'),
  title text not null check (char_length(title) between 3 and 300),
  target text check (target is null or char_length(target) <= 200),
  due_date date,
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  note text check (note is null or char_length(note) <= 1000),
  created_by text,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists agent_tasks_open on public.agent_tasks (agent) where status = 'open';

alter table public.agent_tasks enable row level security;
drop policy if exists staff_all on public.agent_tasks;
create policy staff_all on public.agent_tasks for all to authenticated using (public.is_staff()) with check (public.is_staff());


-- >>> migration 20261006084100_business_rfp_scope.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261006084100_business_rfp_scope.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-06_0841 UTC
-- PURPOSE : The business Request for Proposal keeps its scope of work as structured data (packages/core/src/rfp.ts):
--           square footage, site, each service with how often and specifics, working hours, current vendor, term,
--           decision process (and bid due date), walkthrough times, preferred contact. The Hub shows it with a
--           follow-up checklist of what's still missing.
-- ============================================================================
alter table public.business_accounts
  add column if not exists rfp_scope jsonb,
  add column if not exists preferred_contact text check (preferred_contact is null or preferred_contact in ('call','email','text'));


-- >>> migration 20261006195000_job_coverage.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261006195000_job_coverage.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-06_1950 UTC
-- PURPOSE : Every job gets done (packages/core/src/coverage.ts).
--             * job_backups - backup #1, #2, #3 lined up behind the pro on every accepted job. Status:
--                 asked (we asked) -> standby (they confirmed they can cover) -> called (the pro dropped; their turn)
--                 -> promoted (they took the job) - declined / passed (said no) - released (job done or cancelled)
--             * job_offers.kind adds 'backup' (the call that goes to a backup when the pro drops)
--             * pro_standing_events.kind adds 'short_notice_cancel' (6-24h: logged, no penalty) and 'excused_cancel'
--             * jobs.handoffs - how many times the job changed pros (shown to staff)
-- ============================================================================
create table if not exists public.job_backups (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  rank int not null check (rank between 1 and 3),
  status text not null default 'asked' check (status in ('asked','standby','called','declined','passed','promoted','released')),
  asked_at timestamptz not null default now(),
  responded_at timestamptz,
  called_at timestamptz,
  unique (job_id, contractor_id)
);
create index if not exists job_backups_job_idx on public.job_backups (job_id, rank);
create index if not exists job_backups_pro_idx on public.job_backups (contractor_id, status);

alter table public.job_backups enable row level security;
drop policy if exists "pro reads own backups" on public.job_backups;
create policy "pro reads own backups" on public.job_backups for select to authenticated using (contractor_id = public.my_contractor_id());
drop policy if exists staff_all on public.job_backups;
create policy staff_all on public.job_backups for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.job_offers drop constraint if exists job_offers_kind_check;
alter table public.job_offers add constraint job_offers_kind_check
  check (kind in ('job','recurring','redo','account','favorite','board','backup'));

alter table public.pro_standing_events drop constraint if exists pro_standing_events_kind_check;
alter table public.pro_standing_events add constraint pro_standing_events_kind_check
  check (kind in ('late_cancel','short_notice_cancel','excused_cancel','no_show','warning','suspension','deactivation','appeal','appeal_upheld','reinstated','note'));

alter table public.jobs add column if not exists handoffs int not null default 0;


-- >>> migration 20261006201000_pro_business_address.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261006201000_pro_business_address.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-06_2010 UTC
-- PURPOSE : A pro's place of business (street, city, state, ZIP). Dispatch measures driving distance from it
--           (geocoded street address; ZIP centre when the lookup isn't available - base_located says which).
-- ============================================================================
alter table public.contractors
  add column if not exists base_address text,
  add column if not exists base_city text,
  add column if not exists base_state text check (base_state is null or base_state ~ '^[A-Z]{2}$'),
  add column if not exists base_located text check (base_located is null or base_located in ('address','zip'));


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


