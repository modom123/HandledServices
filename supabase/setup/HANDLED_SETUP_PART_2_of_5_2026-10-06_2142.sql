-- ============================================================================
-- FILE    : supabase/setup/HANDLED_SETUP_PART_2_of_5_2026-10-06_2142.sql
-- PROJECT : Handled (myhumanai)
-- CREATED : 2026-10-06_2142 UTC
-- PURPOSE : NEW Supabase project setup, part 2 of 5 (run IN ORDER, one at a time). Migrations 20261001203000_service_agreement.sql .. 20261002141249_message_language.sql.
--           Plain-ASCII (accented text uses U&'' escapes) so copy/paste can't corrupt it.
--           Supabase -> SQL Editor -> New query -> paste -> Run. Wait for "Success" before the next part.
-- ============================================================================
-- >>> migration 20261001203000_service_agreement.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261001203000_service_agreement.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-01_2030 UTC
-- PURPOSE : Every booking is accepted under the customer Service Agreement printed on its
--           invoice. Record which version, when, and from where it was accepted.
-- ============================================================================
alter table public.jobs
  add column terms_version text,
  add column terms_accepted_at timestamptz,
  add column terms_accepted_ip text;


-- >>> migration 20261001204300_offers_push_notifications.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261001204300_offers_push_notifications.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-01_2043 UTC
-- PURPOSE : Uber-style job offers and phone notifications.
--             * push_tokens     - Expo push tokens per signed-in device (pros and customers)
--             * notifications   - in-app inbox + delivery log of every push/email we send
--             * jobs.instructions - ops/IEBC instructions printed on the pro's work order
--             * job_offers acceptance record - which work-order version the pro agreed to
--             * job_pro(job)    - the customer's safe view of who is covering their job
-- ============================================================================

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  platform text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;
create policy staff_all on public.push_tokens for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy push_tokens_self on public.push_tokens for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create table public.notifications (
  id bigint generated always as identity primary key,
  profile_id uuid references public.profiles(id) on delete cascade,
  email text,
  title text not null,
  body text not null,
  data jsonb not null default '{}',
  channels text[] not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_profile_idx on public.notifications(profile_id, created_at desc);
alter table public.notifications enable row level security;
create policy staff_all on public.notifications for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy notifications_self_read on public.notifications for select to authenticated using (profile_id = auth.uid());
create policy notifications_self_mark on public.notifications for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
alter publication supabase_realtime add table public.notifications;

alter table public.jobs add column instructions text;

alter table public.job_offers
  add column work_order_version text,
  add column terms_accepted_at timestamptz,
  add column accepted_ip text;

-- Who is covering my job? Business name, rating and track record of the assigned pro -
-- only for the customer on that job (customers can't read the contractors table directly).
create or replace function public.job_pro(p_job uuid)
returns table (business_name text, contact_first_name text, rating numeric, jobs_completed int)
language sql stable security definer set search_path = public as $$
  select c.business_name, split_part(c.contact_name, ' ', 1), c.rating, c.jobs_completed
  from public.jobs j join public.contractors c on c.id = j.contractor_id
  where j.id = p_job and (j.customer_id = auth.uid() or public.is_staff())
$$;
grant execute on function public.job_pro(uuid) to authenticated;


-- >>> migration 20261001205300_deposits_quick_charge.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261001205300_deposits_quick_charge.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-01_2053 UTC
-- PURPOSE : Deposits and Quick Charge payment links.
--             * jobs.payment_plan 'full' | 'deposit'; deposit amount, when it was paid, and
--               when the balance is due. A deposit books the date and the pro; the job can't
--               start and the pro isn't paid out until it's paid in full (jobs.paid_at).
--             * payments can exist without a job (a Quick Charge for anything), carry a
--               description, the customer, the Stripe link and who created it.
-- ============================================================================

alter table public.jobs
  add column payment_plan text not null default 'full' check (payment_plan in ('full','deposit')),
  add column deposit_amount numeric(10,2),
  add column deposit_paid_at timestamptz,
  add column balance_due_date date;

alter table public.payments alter column job_id drop not null;
alter table public.payments
  add column description text,
  add column customer_name text,
  add column customer_email text,
  add column link_url text,
  add column created_by text,
  add column paid_at timestamptz;

alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check
  check (kind in ('deposit','final','milestone','plan','upfront','refund','balance','change_order','custom'));


-- >>> migration 20261001210900_pro_vetting.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261001210900_pro_vetting.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-01_2109 UTC
-- PURPOSE : Pro specialties, trade-specific insurance and a richer application.
--             * contractors.specialties - what each pro does best (dispatch prefers specialists)
--             * contractors.coverage    - verified coverage -> expiry, e.g.
--                 {"auto":"2027-05-01","bond":"2027-01-31","workers_comp":"exempt"}
--               (general liability stays in insured_until). Offers stop when one lapses.
--             * contractor_applications - specialties, coverages held, equipment, references,
--               links to past work
--             * contractor_documents.kind - commercial auto, workers' comp, bond, liquor
--               liability, certifications and the skills check
-- ============================================================================

alter table public.contractors
  add column specialties text[] not null default '{}',
  add column coverage jsonb not null default '{}';

alter table public.contractor_applications
  add column specialties text[] not null default '{}',
  add column coverages_held text[] not null default '{}',
  add column equipment text,
  add column references_text text,
  add column work_links text;

alter table public.contractor_documents drop constraint if exists contractor_documents_kind_check;
alter table public.contractor_documents add constraint contractor_documents_kind_check
  check (kind in ('w9','coi','license','background','agreement','auto','workers_comp','bond','liquor','certification','skills','other'));


-- >>> migration 20261001212400_pro_benefits.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261001212400_pro_benefits.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-01_2124 UTC
-- PURPOSE : The six Pro Program benefits.
--             * pro_program_settings - who qualifies for each benefit and its amounts
--               (Handled Hub -> Pro Program; defaults live in packages/core/src/pro-policy.ts)
--             * payouts.kind - job | show_up | guarantee | stipend | materials | clawback,
--               plus instant-pay method, fee and Stripe transfer. Only 'job' payouts are
--               held to the 85%-of-price guard; show-up pay is capped in code at the fee we
--               keep; materials are passed through only after the customer pays them.
--             * job_expenses - materials receipts from pros (auto-approve / staff review)
--             * jobs cancellation record - who cancelled, when, why and the fee kept
-- ============================================================================

create table public.pro_program_settings (
  id int primary key default 1 check (id = 1),
  settings jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.pro_program_settings enable row level security;
create policy staff_all on public.pro_program_settings for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy settings_read on public.pro_program_settings for select to authenticated using (true);
insert into public.pro_program_settings (id) values (1) on conflict (id) do nothing;

alter table public.payouts
  add column kind text not null default 'job' check (kind in ('job','show_up','guarantee','stipend','materials','clawback')),
  add column method text check (method in ('weekly','instant','manual')),
  add column instant_fee numeric(10,2) not null default 0,
  add column stripe_transfer_id text;
update public.payouts set kind = 'clawback' where status = 'clawback';
create index payouts_contractor_status_idx on public.payouts(contractor_id, status);

-- The 85%-of-price guard applies to the job's own payout; complimentary rules unchanged.
create or replace function public.guard_payout_amount() returns trigger
language plpgsql security definer set search_path = public as $$
declare j record; parent_take numeric;
begin
  if new.job_id is null or new.status = 'clawback' or new.kind <> 'job' then return new; end if;
  select price_final, parent_job_id, remedy into j from public.jobs where id = new.job_id;
  if j.remedy = 'complimentary' and j.parent_job_id is not null then
    select coalesce(price_final, 0) - coalesce(contractor_payout, 0) - coalesce(amount_refunded, 0)
      into parent_take from public.jobs where id = j.parent_job_id;
    if new.amount > greatest(parent_take, 0) then
      raise exception 'Complimentary payout % exceeds our take % on the original job', new.amount, parent_take;
    end if;
  elsif j.price_final is not null and new.amount > j.price_final * 0.85 then
    raise exception 'Payout % exceeds 85%% of job price % - take would fall below 15%%', new.amount, j.price_final;
  end if;
  return new;
end $$;

create table public.job_expenses (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  description text not null,
  receipt_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','billed','paid')),
  decided_by text,
  decided_at timestamptz,
  payment_id uuid references public.payments(id) on delete set null,
  payout_id uuid references public.payouts(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);
create index job_expenses_job_idx on public.job_expenses(job_id);
alter table public.job_expenses enable row level security;
create policy staff_all on public.job_expenses for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy expenses_pro_read on public.job_expenses for select to authenticated using (contractor_id = public.my_contractor_id());

alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check
  check (kind in ('deposit','final','milestone','plan','upfront','refund','balance','change_order','custom','materials'));

alter table public.jobs
  add column cancelled_at timestamptz,
  add column cancel_reason text check (cancel_reason in ('customer','late','lockout','ops','weather','pro')),
  add column cancel_fee numeric(10,2) not null default 0;

alter table public.contractors add column insurance_stipend_paid_at timestamptz;


-- >>> migration 20261001233400_dispatch_geo_availability.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261001233400_dispatch_geo_availability.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-01_2334 UTC
-- PURPOSE : Dispatch by availability, quality and location.
--             * contractors: base ZIP + coordinates, driving radius, working days/windows,
--               time off - used by dispatch and the customer booking calendar
--             * jobs: coordinates (ZIP centroid) for distance to each pro
--             * zip_geo: cached ZIP centroids (looked up once, reused)
--             * jobs.scope_extra: extra work the pro found on site (change orders) - the
--               underbid signal Finance reports per service
-- ============================================================================

alter table public.contractors
  add column base_zip text check (base_zip ~ '^[0-9]{5}$'),
  add column base_lat double precision,
  add column base_lng double precision,
  add column service_radius_mi int not null default 25 check (service_radius_mi between 1 and 150),
  add column availability jsonb,
  add column time_off date[] not null default '{}';

alter table public.jobs
  add column lat double precision,
  add column lng double precision,
  add column scope_extra numeric(10,2) not null default 0;

create table public.zip_geo (
  zip text primary key check (zip ~ '^[0-9]{5}$'),
  lat double precision not null,
  lng double precision not null,
  city text,
  state text,
  fetched_at timestamptz not null default now()
);
alter table public.zip_geo enable row level security;
create policy zip_geo_read on public.zip_geo for select to anon, authenticated using (true);


-- >>> migration 20261002000600_pro_recruiting.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261002000600_pro_recruiting.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-02_0006 UTC
-- PURPOSE : Automated pro recruiting & onboarding, tracked end to end.
--             * contractor_applications: where the applicant came from (source, referral,
--               UTM), the pipeline stage, timestamps, follow-ups sent and the linked contractor
--             * contractors: invite / reminder tracking, background-check provider status
--             * contractor_documents.ai_check: AI reading of each uploaded certificate/license
--             * recruiting_events: every touch (applied, screened, invited, reminded, step done,
--               document verified, background clear, activated, dropped) - the full history
--             * recruiting_settings: auto-invite / auto-activate / reminder schedule (Hub)
--             * fix: link a pro record to an existing login with the same email (people who
--               signed up before they applied were locked out of the pro portal)
-- ============================================================================

alter table public.contractor_applications
  add column source text,
  add column referred_by uuid references public.contractors(id) on delete set null,
  add column utm jsonb,
  add column stage text not null default 'applied' check (stage in ('applied','screened','invited','rejected','withdrawn')),
  add column screened_at timestamptz,
  add column invited_at timestamptz,
  add column decided_by text,
  add column last_contact_at timestamptz,
  add column reminders_sent int not null default 0,
  add column contractor_id uuid references public.contractors(id) on delete set null;
create index contractor_applications_email_idx on public.contractor_applications(lower(email));
update public.contractor_applications set stage = case status when 'approved' then 'invited' when 'rejected' then 'rejected' else 'applied' end;

alter table public.contractors
  add column invited_at timestamptz,
  add column last_reminder_at timestamptz,
  add column onboarding_reminders int not null default 0,
  add column background_provider_id text,
  add column background_status text check (background_status in ('invited','pending','clear','consider','suspended','canceled')),
  add column dropped_at timestamptz;

alter table public.contractor_documents add column ai_check jsonb;

create table public.recruiting_events (
  id bigint generated always as identity primary key,
  application_id uuid references public.contractor_applications(id) on delete cascade,
  contractor_id uuid references public.contractors(id) on delete cascade,
  kind text not null,
  note text,
  actor text not null default 'system',
  created_at timestamptz not null default now()
);
create index recruiting_events_app_idx on public.recruiting_events(application_id, created_at);
create index recruiting_events_pro_idx on public.recruiting_events(contractor_id, created_at);
alter table public.recruiting_events enable row level security;
create policy staff_all on public.recruiting_events for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table public.recruiting_settings (
  id int primary key default 1 check (id = 1),
  settings jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.recruiting_settings enable row level security;
create policy staff_all on public.recruiting_settings for all to authenticated using (public.is_staff()) with check (public.is_staff());
insert into public.recruiting_settings (id) values (1) on conflict (id) do nothing;

-- Link a pro record to an existing login with the same email, whenever the record is created
-- or its email changes (the sign-up trigger only covered logins created afterwards).
create or replace function public.link_contractor_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.profile_id is null then
    select id into new.profile_id from public.profiles where lower(email) = lower(new.email) limit 1;
  end if;
  return new;
end $$;
create trigger contractors_link_profile before insert or update of email on public.contractors
  for each row execute function public.link_contractor_profile();

create or replace function public.promote_contractor_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.profile_id is not null then
    update public.profiles set role = 'pro' where id = new.profile_id and role = 'customer';
  end if;
  return new;
end $$;
create trigger contractors_promote_profile after insert or update of profile_id on public.contractors
  for each row execute function public.promote_contractor_profile();

-- backfill: existing pro records whose person already had a login
update public.contractors c set profile_id = p.id from public.profiles p
  where c.profile_id is null and lower(p.email) = lower(c.email);


-- >>> migration 20261002015700_iebc_recruiting_roles.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261002015700_iebc_recruiting_roles.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-02_0157 UTC
-- PURPOSE : IEBC recruiting agents work the automated onboarding pipeline.
--             * Tyler Walsh - recruiting pipeline: screening, invites, follow-up with stuck applicants
--             * Marcus Hill - onboarding compliance: documents (with AI readings) & background checks
--           Both run low-risk actions (reminders, notes, revive, order a background check) on
--           their own; inviting, activating and verifying documents are high-risk and always
--           wait for human approval in Handled Hub -> IEBC Workforce.
-- ============================================================================
update public.iebc_agents set role_here = 'Recruiting pipeline: screening, invites & follow-up with stuck applicants', autonomy = 'autonomous'
  where iebc_employee_id = 'tylerw';
update public.iebc_agents set role_here = 'Onboarding compliance: insurance & license documents, background checks', autonomy = 'autonomous'
  where iebc_employee_id = 'marcushr';


-- >>> migration 20261002020100_transportation.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261002020100_transportation.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-02_0201 UTC
-- PURPOSE : Transportation (private driver, airport transfer, limousine, party bus, charter bus,
--           event shuttle) booked with licensed operator companies. Operators upload passenger-
--           carrier auto liability ($1.5M up to 15 seats / $5M for 16+), stored as coverage
--           kind 'passenger_auto'. The services themselves come from the catalog sync / seed.
-- ============================================================================
alter table public.contractor_documents drop constraint if exists contractor_documents_kind_check;
alter table public.contractor_documents add constraint contractor_documents_kind_check
  check (kind in ('w9','coi','license','background','agreement','auto','workers_comp','bond','liquor','passenger_auto','certification','skills','other'));


-- >>> migration 20261002023316_pro_promises.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261002023316_pro_promises.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-02_0233 UTC
-- PURPOSE : What the Pro Program promises, backed by data:
--             * offer status 'taken' - another pro accepted first; doesn't count against
--               anyone's acceptance rate (tiers use real acceptance and on-time numbers)
--             * payout kind 'referral' + contractors.referral_bonus_paid_at - the refer-a-pro
--               bonus is paid automatically, exactly once
--             * payouts.week_of - the automatic Monday payout run each payout went out in
--             * job_offers.kind - 'recurring' (your recurring customer, offered to you first)
--               and 'redo' (your first chance to fix a job) so pros see why they got it
-- ============================================================================
alter type offer_status add value if not exists 'taken';

alter table public.payouts drop constraint if exists payouts_kind_check;
alter table public.payouts add constraint payouts_kind_check
  check (kind in ('job','show_up','guarantee','stipend','materials','clawback','referral'));
alter table public.payouts add column if not exists week_of date;

alter table public.contractors add column if not exists referral_bonus_paid_at timestamptz;

alter table public.job_offers add column if not exists kind text not null default 'job'
  check (kind in ('job','recurring','redo'));


-- >>> migration 20261002025553_pro_roster.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261002025553_pro_roster.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-02_0255 UTC
-- PURPOSE : Know where pros are and when they can work:
--             * on_call_until - the pro switched "On call" on (same-day work) until this time
--             * last_lat / last_lng / last_located_at - last phone location, shared only while
--               on call or on a job today; the daily sweep clears it after 12 hours
--           Their calendar (jobs ahead, days off, daily limit) uses existing columns.
-- ============================================================================
alter table public.contractors
  add column if not exists on_call_until timestamptz,
  add column if not exists last_lat double precision,
  add column if not exists last_lng double precision,
  add column if not exists last_located_at timestamptz;

create index if not exists contractors_on_call_idx on public.contractors (on_call_until) where on_call_until is not null;
create index if not exists jobs_contractor_date_idx on public.jobs (contractor_id, scheduled_date);


-- >>> migration 20261002030209_customer_timing_budget.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261002030209_customer_timing_budget.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-02_0302 UTC
-- PURPOSE : Track what customers tell us when they ask for work:
--             jobs.urgency          - asap / this_week / two_weeks / month / flexible
--             jobs.needed_by        - last day they need it done (deadline alerts use it)
--             jobs.customer_budget  - what they want to spend (never changes our price)
--             business_accounts.monthly_budget / start_by - the same for business proposals
-- ============================================================================
alter table public.jobs
  add column if not exists urgency text check (urgency in ('asap','this_week','two_weeks','month','flexible')),
  add column if not exists needed_by date,
  add column if not exists customer_budget numeric(12,2) check (customer_budget is null or customer_budget >= 0);

create index if not exists jobs_needed_by_idx on public.jobs (needed_by) where status not in ('completed','cancelled');

alter table public.business_accounts
  add column if not exists monthly_budget numeric(12,2),
  add column if not exists start_by text check (start_by in ('asap','this_week','two_weeks','month','flexible'));


-- >>> migration 20261002031601_launch_growth.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261002031601_launch_growth.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-02_0316 UTC
-- PURPOSE : Launch blockers + growth + customer experience, in one place:
--             * rate_limits + hit_rate_limit()   - abuse limits on public endpoints (AI, uploads)
--             * payment_disputes                 - Stripe chargebacks: payout held, ops alerted
--             * promo_codes / promo_redemptions  - promo codes, gift cards, referral rewards
--             * memberships                      - Handled Plus (monthly subscription)
--             * tips                             - 100% to the pro
--             * jobs: discount, promo_code, attribution, en_route_at
--             * profiles: locale, sms_opt_out, referred_by, referral_rewarded_at,
--               deleted_at (account deletion keeps tax/financial records, drops personal data)
-- ============================================================================

-- --- Abuse limits -----------------------------------------------------------
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

-- --- Chargebacks ------------------------------------------------------------
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

-- --- Money kinds ------------------------------------------------------------
alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check
  check (kind in ('deposit','final','milestone','plan','upfront','refund','balance','change_order','custom','materials','tip','gift_card','membership'));

alter table public.payouts drop constraint if exists payouts_kind_check;
alter table public.payouts add constraint payouts_kind_check
  check (kind in ('job','show_up','guarantee','stipend','materials','clawback','referral','tip'));

-- --- Promo codes, gift cards, referral rewards ------------------------------
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

-- --- Handled Plus membership ------------------------------------------------
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

-- --- Tips -------------------------------------------------------------------
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

-- --- Jobs & profiles --------------------------------------------------------
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

-- --- Account deletion: nothing may block removing a person ------------------
alter table public.messages drop constraint if exists messages_sender_id_fkey;
alter table public.messages add constraint messages_sender_id_fkey foreign key (sender_id) references public.profiles(id) on delete set null;
alter table public.business_accounts drop constraint if exists business_accounts_owner_profile_id_fkey;
alter table public.business_accounts add constraint business_accounts_owner_profile_id_fkey foreign key (owner_profile_id) references public.profiles(id) on delete set null;


-- >>> migration 20261002134642_launch_checklist.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261002134642_launch_checklist.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-02_1346 UTC
-- PURPOSE : Business & legal launch checklist ticks (items live in @handled/core
--           launch-checklist.ts): who ticked it, when, and a note (policy number, attorney...).
-- ============================================================================
create table if not exists public.launch_checklist (
  key text primary key,
  done_at timestamptz,
  done_by text,
  note text,
  updated_at timestamptz not null default now()
);
alter table public.launch_checklist enable row level security;


-- >>> migration 20261002141249_message_language.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261002141249_message_language.sql
-- PROJECT : Handled (myhumanai) - AI-run home & business services
-- CREATED : 2026-10-02_1412 UTC
-- PURPOSE : Each person chooses English or Spanish, and every text, email, push notification
--           and timeline entry follows it:
--             * profiles.locale (already exists) - signed-in customers and pros
--             * jobs.locale - the language a booking was made in (guests have no profile)
--             * contractor_applications.locale - applicants, before they have an account
--             * job_events.message_es - Spanish version of each timeline entry
-- ============================================================================
alter table public.jobs add column if not exists locale text not null default 'en' check (locale in ('en','es'));
alter table public.contractor_applications add column if not exists locale text not null default 'en' check (locale in ('en','es'));
alter table public.job_events add column if not exists message_es text;


