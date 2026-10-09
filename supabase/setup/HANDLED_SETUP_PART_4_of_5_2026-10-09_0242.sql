-- ============================================================================
-- FILE    : supabase/setup/HANDLED_SETUP_PART_4_of_5_2026-10-09_0242.sql
-- PROJECT : Handled (myhumanai)
-- CREATED : 2026-10-09_0242 UTC
-- PURPOSE : NEW Supabase project setup, part 4 of 5 (run IN ORDER, one at a time). Migrations 20261005144100_gov_contracts.sql .. 20261006195000_job_coverage.sql.
--           Plain-ASCII (accented text uses U&'' escapes) so copy/paste can't corrupt it.
--           Supabase -> SQL Editor -> New query -> paste -> Run. Wait for "Success" before the next part.
-- ============================================================================
-- >>> migration 20261005144100_gov_contracts.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261005144100_gov_contracts.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
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
-- PROJECT : Handled (HandledServices) - AI-run home & business services
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
-- PROJECT : Handled (HandledServices) - AI-run home & business services
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


-- >>> migration 20261005203900_bid_archive.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261005203900_bid_archive.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
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
-- PROJECT : Handled (HandledServices) - AI-run home & business services
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
-- PROJECT : Handled (HandledServices) - AI-run home & business services
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
-- PROJECT : Handled (HandledServices) - AI-run home & business services
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
-- PROJECT : Handled (HandledServices) - AI-run home & business services
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
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-06_0708 UTC
-- PURPOSE : In-app payments (Apple Pay, Google Pay, card via Stripe PaymentSheet): a payment row
--           remembers its PaymentIntent, so the webhook can settle it and support can look it up.
-- ============================================================================
alter table public.payments add column if not exists stripe_payment_intent_id text;
create index if not exists payments_stripe_payment_intent_idx on public.payments (stripe_payment_intent_id) where stripe_payment_intent_id is not null;


-- >>> migration 20261006072600_lock_down_rpc.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261006072600_lock_down_rpc.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
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
-- PROJECT : Handled (HandledServices) - AI-run home & business services
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
-- PROJECT : Handled (HandledServices) - AI-run home & business services
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
-- PROJECT : Handled (HandledServices) - AI-run home & business services
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


