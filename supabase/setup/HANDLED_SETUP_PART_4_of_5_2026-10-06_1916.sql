-- ============================================================================
-- FILE    : supabase/setup/HANDLED_SETUP_PART_4_of_5_2026-10-06_1916.sql
-- PROJECT : Handled (myhumanai)
-- CREATED : 2026-10-06_1916 UTC
-- PURPOSE : NEW Supabase project setup, part 4 of 5 (run the parts IN ORDER, one at a time).
--           Migrations 20261005012800_biz_job_posts.sql .. 20261005203400_handled_talent.sql.
--           Plain-ASCII copy of HANDLED_SETUP (same SQL; accented text uses U&'' escapes) so copy/paste
--           can't corrupt it. Supabase -> SQL Editor -> New query -> paste -> Run. Wait for "Success".
-- ============================================================================
-- >>> migration 20261005012800_biz_job_posts.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261005012800_biz_job_posts.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
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
-- PROJECT : Handled (myhumanai) - AI-run home & business services
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
-- PROJECT : Handled (myhumanai) - AI-run home & business services
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
-- PROJECT : Handled (myhumanai) - AI-run home & business services
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
-- PROJECT : Handled (myhumanai) - AI-run home & business services
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


-- >>> migration 20261005144100_gov_contracts.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261005144100_gov_contracts.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-05_1441 UTC
-- PURPOSE : Government contracts from SAM.gov (packages/core/src/gov-contracts.ts, Hub -> Gov contracts).
--             * gov_settings       - the saved daily search: on/off, NAICS codes, state, keywords, notice types, days back,
--                                    daily API call budget, certifications we hold (for set-asides)
--             * gov_opportunities  - every notice we've pulled (cached so the 10-calls-a-day key goes far), its fit
--                                    score, our pipeline status (new -> reviewing -> bidding -> submitted -> won / lost,
--                                    or passed), notes, the full description and the AI bid summary
--             * gov_api_calls      - one row per SAM.gov call, to stay inside the daily budget
--             * gov_pro_interest   - pros we've asked about an opportunity and their answer (capacity, rate)
--           Staff only. The SAM.gov API key lives in Vercel (SAM_API_KEY), never in the database.
-- ============================================================================
create table if not exists public.gov_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  naics text[] not null default array['561720','561730','561790','561612','562111','484210']::text[],
  state text default 'MI',
  keywords text,
  ptypes text[] not null default array['o','k','p','r']::text[],
  days_back int not null default 7 check (days_back between 1 and 364),
  daily_call_budget int not null default 8 check (daily_call_budget between 1 and 1000),
  certifications text[] not null default '{}'::text[],
  last_run_at timestamptz,
  last_result jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.gov_settings enable row level security;
create policy staff_all on public.gov_settings for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.gov_opportunities (
  notice_id text primary key,
  title text not null,
  solicitation_number text,
  agency text,
  office text,
  notice_type text,
  ptype text,
  set_aside_code text,
  set_aside text,
  naics text,
  psc text,
  posted_date date,
  response_deadline timestamptz,
  archive_date date,
  active boolean not null default true,
  pop_city text,
  pop_state text,
  pop_zip text,
  ui_link text,
  description_url text,
  contacts jsonb not null default '[]'::jsonb,
  award_amount numeric,
  awardee text,
  fit_score int not null default 0,
  fit jsonb,
  services text[] not null default '{}'::text[],
  status text not null default 'new' check (status in ('new','reviewing','bidding','submitted','won','lost','passed')),
  owner text,
  notes text,
  description text,
  ai_summary jsonb,
  raw jsonb,
  first_seen timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gov_opportunities_fit on public.gov_opportunities (status, fit_score desc);
create index if not exists gov_opportunities_deadline on public.gov_opportunities (response_deadline);
alter table public.gov_opportunities enable row level security;
create policy staff_all on public.gov_opportunities for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.gov_api_calls (
  id bigserial primary key,
  called_at timestamptz not null default now(),
  kind text not null default 'search' check (kind in ('search','description')),
  query text,
  ok boolean not null default true,
  records int,
  error text,
  actor text not null default 'system'
);
create index if not exists gov_api_calls_day on public.gov_api_calls (called_at);
alter table public.gov_api_calls enable row level security;
create policy staff_all on public.gov_api_calls for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.gov_pro_interest (
  notice_id text not null references public.gov_opportunities(notice_id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  status text not null default 'asked' check (status in ('asked','interested','not_interested')),
  note text,
  asked_at timestamptz not null default now(),
  answered_at timestamptz,
  primary key (notice_id, contractor_id)
);
alter table public.gov_pro_interest enable row level security;
create policy staff_all on public.gov_pro_interest for all to authenticated using (public.is_staff()) with check (public.is_staff());

insert into public.gov_settings (id) values (1) on conflict (id) do nothing;


-- >>> migration 20261005195400_bid_engine.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261005195400_bid_engine.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-05_1954 UTC
-- PURPOSE : The bid engine (packages/core/src/bid-engine.ts, Hub -> Bids): one workspace per public bid.
--             * bids             - the bid: source, agency, deadlines, status, go / no-go answers, pricing assumptions,
--                                  review sign-off, submission and result (our price, winning price, winner)
--             * bid_requirements - the compliance matrix: every "shall / must", form, deadline and attachment, with
--                                  where our response answers it and who checked it off
--             * bid_cost_lines   - the price lines (item, unit, quantity per year, years, pro cost, materials, last award)
--             * bid_pro_quotes   - pros' written prices per line and capacity, collected through a private link
--             * bid_documents    - the solicitation, addenda, price form, drafts and the submission confirmation
--                                  (private storage bucket "bids")
--             * bid_benchmarks   - what work went for before (award notices, bid tabs, our own results), for pricing
--           Staff only; pros reach their own quote only through the token link (server-side).
-- ============================================================================
create table if not exists public.bids (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  agency text,
  source text not null default 'other' check (source in ('sam','city','county','state','school','private','other')),
  notice_id text references public.gov_opportunities(notice_id) on delete set null,
  solicitation_number text,
  link text,
  due_at timestamptz,
  questions_due_at timestamptz,
  submit_method text,
  term_years numeric,
  status text not null default 'draft' check (status in ('draft','no_bid','pricing','review','ready','submitted','won','lost','cancelled')),
  go jsonb not null default '{}'::jsonb,
  no_bid_reason text,
  assumptions jsonb not null default '{}'::jsonb,
  margin_override boolean not null default false,
  ai_summary jsonb,
  owner text,
  review jsonb not null default '{}'::jsonb,
  reviewer text,
  reviewed_at timestamptz,
  submitted_at timestamptz,
  submitted_by text,
  our_price numeric,
  award_amount numeric,
  winning_price numeric,
  winner text,
  result_note text,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bids_status on public.bids (status, due_at);
alter table public.bids enable row level security;
create policy staff_all on public.bids for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.bid_requirements (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid not null references public.bids(id) on delete cascade,
  kind text not null default 'requirement' check (kind in ('eligibility','form','requirement','insurance','price_form','deadline','question','attachment','evaluation')),
  text text not null,
  source_ref text,
  response_ref text,
  required boolean not null default true,
  done boolean not null default false,
  done_by text,
  done_at timestamptz,
  note text,
  origin text not null default 'manual' check (origin in ('standard','ai','manual')),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists bid_requirements_bid on public.bid_requirements (bid_id, kind, sort);
alter table public.bid_requirements enable row level security;
create policy staff_all on public.bid_requirements for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.bid_cost_lines (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid not null references public.bids(id) on delete cascade,
  item text not null,
  unit text not null default 'each',
  qty numeric not null default 0 check (qty >= 0),
  years numeric not null default 1 check (years >= 0),
  pro_unit_cost numeric check (pro_unit_cost is null or pro_unit_cost >= 0),
  materials_unit numeric not null default 0 check (materials_unit >= 0),
  benchmark numeric check (benchmark is null or benchmark >= 0),
  slug text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists bid_cost_lines_bid on public.bid_cost_lines (bid_id, sort);
alter table public.bid_cost_lines enable row level security;
create policy staff_all on public.bid_cost_lines for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.bid_pro_quotes (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid not null references public.bids(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  token text not null unique,
  status text not null default 'asked' check (status in ('asked','committed','declined')),
  prices jsonb not null default '{}'::jsonb,
  capacity text,
  small_business boolean,
  note text,
  asked_at timestamptz not null default now(),
  answered_at timestamptz,
  unique (bid_id, contractor_id)
);
alter table public.bid_pro_quotes enable row level security;
create policy staff_all on public.bid_pro_quotes for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.bid_documents (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid not null references public.bids(id) on delete cascade,
  kind text not null default 'other' check (kind in ('rfq','addendum','price_form','draft','confirmation','other')),
  name text not null,
  path text not null,
  size int,
  ai_read_at timestamptz,
  uploaded_by text,
  created_at timestamptz not null default now()
);
create index if not exists bid_documents_bid on public.bid_documents (bid_id, created_at);
alter table public.bid_documents enable row level security;
create policy staff_all on public.bid_documents for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.bid_benchmarks (
  id uuid primary key default gen_random_uuid(),
  item text not null,
  unit text not null,
  price numeric not null check (price >= 0),
  agency text,
  source text,
  award_date date,
  bid_id uuid references public.bids(id) on delete set null,
  note text,
  created_by text,
  created_at timestamptz not null default now()
);
alter table public.bid_benchmarks enable row level security;
create policy staff_all on public.bid_benchmarks for all to authenticated using (public.is_staff()) with check (public.is_staff());

insert into storage.buckets (id, name, public) values ('bids', 'bids', false) on conflict (id) do nothing;


-- >>> migration 20261005203400_handled_talent.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261005203400_handled_talent.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-05_2034 UTC
-- PURPOSE : Handled Talent - recruiting agency as a service (packages/core/src/talent.ts; Hub -> Talent; /pro/talent).
--             * talent_clients           - companies that hire through us, their fee terms and signed agreement
--             * talent_searches          - job orders (contingency or retained), the client review link, fair-hiring flags
--             * talent_search_recruiters - independent recruiters (pros with the "recruiter" trade) on each search
--             * talent_candidates        - candidates, resume, consent to be represented, the recruiter who found them
--             * talent_submissions       - a candidate on a search: stage, write-up, client feedback, offer, start date;
--                                          first written submission owns the candidate for that client for 12 months
--             * talent_events            - the activity log for each submission
--             * talent_placements        - hires: salary, fee, recruiter / Handled split, invoice, payment, guarantee
--             * talent_retainer_payments - the three retained payments per retained search
--           Payouts to recruiters go through the existing payouts table (kind 'placement') and the weekly Stripe run;
--           client invoices through payments (kind 'invoice') and the Stripe webhook.
--           Staff manage everything; recruiters reach their own searches and candidates through the API (server-side);
--           clients review candidates through their search's private link. Resumes live in the private "talent" bucket.
-- ============================================================================
create table if not exists public.talent_clients (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  contact_name text not null,
  email text not null,
  phone text,
  website text,
  industry text,
  city text,
  business_account_id uuid references public.business_accounts(id) on delete set null,
  terms jsonb not null default '{}'::jsonb,
  status text not null default 'prospect' check (status in ('prospect','active','inactive')),
  agreement_version text,
  agreement_signed_at timestamptz,
  agreement_signed_by text,
  agreement_ip text,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists talent_clients_email on public.talent_clients (lower(email));
alter table public.talent_clients enable row level security;
create policy staff_all on public.talent_clients for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.talent_searches (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.talent_clients(id) on delete cascade,
  title text not null,
  location text,
  workplace text not null default 'onsite' check (workplace in ('onsite','hybrid','remote')),
  salary_min numeric check (salary_min is null or salary_min >= 0),
  salary_max numeric check (salary_max is null or salary_max >= 0),
  openings int not null default 1 check (openings between 1 and 100),
  description text,
  must_haves text,
  type text not null default 'contingency' check (type in ('contingency','retained')),
  fee_pct numeric not null check (fee_pct > 0 and fee_pct <= 50),
  recruiter_pct numeric not null check (recruiter_pct >= 0),
  minimum_fee numeric not null default 0 check (minimum_fee >= 0),
  estimated_salary numeric,
  engaged_on date,
  exclusive boolean not null default false,
  status text not null default 'intake' check (status in ('intake','open','on_hold','filled','cancelled')),
  review_token text not null unique,
  fair_flags jsonb not null default '[]'::jsonb,
  fair_override text,
  created_by text,
  created_at timestamptz not null default now(),
  filled_at timestamptz,
  check (recruiter_pct <= fee_pct)
);
create index if not exists talent_searches_status on public.talent_searches (status, created_at desc);
alter table public.talent_searches enable row level security;
create policy staff_all on public.talent_searches for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.talent_search_recruiters (
  search_id uuid not null references public.talent_searches(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  role text not null default 'support' check (role in ('lead','support')),
  assigned_at timestamptz not null default now(),
  primary key (search_id, contractor_id)
);
alter table public.talent_search_recruiters enable row level security;
create policy staff_all on public.talent_search_recruiters for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.talent_candidates (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  location text,
  current_title text,
  linkedin text,
  resume_path text,
  summary text,
  source text,
  owner_contractor_id uuid references public.contractors(id) on delete set null,
  consent_at timestamptz,
  consent_method text,
  do_not_contact boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists talent_candidates_email on public.talent_candidates (lower(email));
alter table public.talent_candidates enable row level security;
create policy staff_all on public.talent_candidates for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.talent_submissions (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.talent_searches(id) on delete cascade,
  client_id uuid not null references public.talent_clients(id) on delete cascade,
  candidate_id uuid not null references public.talent_candidates(id) on delete cascade,
  recruiter_id uuid references public.contractors(id) on delete set null,
  stage text not null default 'sourced' check (stage in ('sourced','screened','submitted','client_review','interview','offer','placed','rejected','withdrawn')),
  pitch text,
  expected_salary numeric,
  submitted_at timestamptz,
  candidate_confirm_token text unique,
  candidate_confirmed_at timestamptz,
  client_feedback text,
  client_decision text check (client_decision in ('interview','pass','hold')),
  interview_at timestamptz,
  offer_salary numeric,
  start_date date,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (search_id, candidate_id)
);
create index if not exists talent_submissions_owner on public.talent_submissions (client_id, candidate_id, submitted_at);
alter table public.talent_submissions enable row level security;
create policy staff_all on public.talent_submissions for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.talent_events (
  id bigserial primary key,
  submission_id uuid references public.talent_submissions(id) on delete cascade,
  search_id uuid references public.talent_searches(id) on delete cascade,
  actor text not null,
  kind text not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists talent_events_sub on public.talent_events (submission_id, created_at);
alter table public.talent_events enable row level security;
create policy staff_all on public.talent_events for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.talent_placements (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.talent_submissions(id) on delete restrict,
  search_id uuid not null references public.talent_searches(id) on delete restrict,
  client_id uuid not null references public.talent_clients(id) on delete restrict,
  candidate_id uuid not null references public.talent_candidates(id) on delete restrict,
  recruiter_id uuid references public.contractors(id) on delete set null,
  base_salary numeric not null check (base_salary > 0),
  fee_pct numeric not null,
  fee numeric not null check (fee >= 0),
  recruiter_pay numeric not null check (recruiter_pay >= 0),
  platform numeric not null,
  start_date date not null,
  invoice_number text unique,
  invoice_due date,
  payment_url text,
  amount_paid numeric not null default 0,
  paid_at timestamptz,
  status text not null default 'pending_start' check (status in ('pending_start','invoiced','paid','guarantee_claim','replaced','refunded','void')),
  guarantee_ends date,
  exit_date date,
  exit_reason text,
  remedy text check (remedy in ('replacement','refund')),
  refund numeric not null default 0,
  created_by text,
  created_at timestamptz not null default now()
);
alter table public.talent_placements enable row level security;
create policy staff_all on public.talent_placements for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.talent_retainer_payments (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.talent_searches(id) on delete cascade,
  key text not null check (key in ('engagement','shortlist','placement')),
  amount numeric not null check (amount >= 0),
  recruiter_pay numeric not null default 0 check (recruiter_pay >= 0),
  recruiter_id uuid references public.contractors(id) on delete set null,
  due date,
  status text not null default 'scheduled' check (status in ('scheduled','invoiced','paid','void')),
  invoice_number text unique,
  payment_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (search_id, key)
);
alter table public.talent_retainer_payments enable row level security;
create policy staff_all on public.talent_retainer_payments for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- recruiter pay rides the existing payout run (weekly Stripe transfers, statements, 1099s)
alter table public.payouts drop constraint if exists payouts_kind_check;
alter table public.payouts add constraint payouts_kind_check
  check (kind in ('job','show_up','guarantee','stipend','materials','clawback','referral','tip','placement'));
alter table public.payouts add column if not exists talent_placement_id uuid references public.talent_placements(id) on delete set null;
alter table public.payouts add column if not exists talent_retainer_id uuid references public.talent_retainer_payments(id) on delete set null;
create unique index if not exists payouts_talent_placement_once on public.payouts (talent_placement_id) where kind = 'placement' and talent_placement_id is not null;
create unique index if not exists payouts_talent_retainer_once on public.payouts (talent_retainer_id) where kind = 'placement' and talent_retainer_id is not null;

-- client invoices settle through the Stripe webhook
alter table public.payments add column if not exists talent_placement_id uuid references public.talent_placements(id) on delete set null;
alter table public.payments add column if not exists talent_retainer_id uuid references public.talent_retainer_payments(id) on delete set null;

insert into storage.buckets (id, name, public) values ('talent', 'talent', false) on conflict (id) do nothing;


