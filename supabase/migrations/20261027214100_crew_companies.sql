-- ============================================================================
-- FILE    : supabase/migrations/20261027214100_crew_companies.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-27_2141 UTC
-- PURPOSE : Crew companies (e.g. "Atkins & Sons") sign up as a company and say how they want to be treated,
--           and that choice follows them through recruiting, onboarding, dispatch and what customers see.
--             • contractor_applications.account_type / owner_on_site / customer_display / crew_roster
--                 — chosen on the pro application; the roster is the people they plan to send
--             • contractors.account_type      solo | crew
--             • contractors.owner_on_site     always | sometimes | never (never = a crew member is picked
--                                             for every job before it starts)
--             • contractors.customer_display  person | company (customers see the business name only)
--             • contractors.crew_license_trades  trades held by an active, cleared licensed tech on the crew
--                                             (licensed work can be dispatched to the company through them)
--             • job_pro(job) — leaves the owner's first name out when the company asked to be shown by name
--           Safe to run twice.
-- ============================================================================
alter table public.contractor_applications
  add column if not exists account_type text not null default 'solo',
  add column if not exists owner_on_site text,
  add column if not exists customer_display text,
  add column if not exists crew_roster jsonb not null default '[]'::jsonb;

alter table public.contractors
  add column if not exists account_type text not null default 'solo',
  add column if not exists owner_on_site text not null default 'always',
  add column if not exists customer_display text not null default 'person',
  add column if not exists crew_license_trades text[] not null default '{}';

do $$ begin
  alter table public.contractor_applications add constraint contractor_applications_account_type_check check (account_type in ('solo','crew'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.contractor_applications add constraint contractor_applications_owner_on_site_check check (owner_on_site is null or owner_on_site in ('always','sometimes','never'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.contractor_applications add constraint contractor_applications_customer_display_check check (customer_display is null or customer_display in ('person','company'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.contractors add constraint contractors_account_type_check check (account_type in ('solo','crew'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.contractors add constraint contractors_owner_on_site_check check (owner_on_site in ('always','sometimes','never'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.contractors add constraint contractors_customer_display_check check (customer_display in ('person','company'));
exception when duplicate_object then null; end $$;

-- pros who already listed a crew are crew companies
update public.contractors c set account_type = 'crew'
where account_type = 'solo' and (c.crew_attested_at is not null or exists (select 1 from public.crew_members m where m.contractor_id = c.id and m.active));

-- licensed techs already on a crew
update public.contractors c set crew_license_trades = coalesce((
  select array_agg(distinct t) from public.crew_members m, unnest(m.trades) t
  where m.contractor_id = c.id and m.active and m.role = 'licensed' and m.background_status = 'clear' and m.license_number is not null
), '{}')
where exists (select 1 from public.crew_members m where m.contractor_id = c.id);

-- Who is covering my job? A company shown by name returns no first name (the crew member who came is job_crew).
create or replace function public.job_pro(p_job uuid)
returns table (business_name text, contact_first_name text, rating numeric, jobs_completed int)
language sql stable security definer set search_path = public as $$
  select c.business_name, case when c.customer_display = 'company' then '' else split_part(c.contact_name, ' ', 1) end, c.rating, c.jobs_completed
  from public.jobs j join public.contractors c on c.id = j.contractor_id
  where j.id = p_job and (j.customer_id = auth.uid() or public.is_staff())
$$;
revoke execute on function public.job_pro(uuid) from public, anon;
grant execute on function public.job_pro(uuid) to authenticated;
