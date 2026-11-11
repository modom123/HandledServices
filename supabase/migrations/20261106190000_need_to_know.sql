-- ============================================================================
-- FILE    : supabase/migrations/20261106190000_need_to_know.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-11-06_1900 UTC
-- PURPOSE : Need-to-know data access. Only ADMINS see everything.
--             Customers and pros: no direct reads of jobs or job offers any more. The website and the app read them
--               through the server, which returns only what each one needs (a pro gets their NET pay, never the job
--               price, Handled's take or the referral split; a customer never sees pro pay or partner data).
--               The other rules that check "is this my job?" (messages, timeline, payments, entry details, reviews)
--               use small security-definer checks instead of reading the jobs table. Pros see only the customer-facing
--               timeline of their jobs.
--             Dispatchers (staff who aren't admins): every job column except the money internals — pro pay, the
--               referral partner fields and AI dispatch notes are readable by no signed-in user directly (the server's
--               admin pages read them with the service key). Offer pay is hidden the same way. Payouts and partner
--               commissions are admin-only.
--           New columns added to jobs or job_offers later are NOT readable by signed-in users until granted here
--           (fails closed). Safe to run twice.
-- ============================================================================

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.app_role() = 'admin'
$$;

-- "is this my job?" without reading jobs through RLS
create or replace function public.customer_owns_job(j uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.jobs where id = j and customer_id = auth.uid())
$$;
create or replace function public.customer_owns_completed_job(j uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.jobs where id = j and customer_id = auth.uid() and status = 'completed')
$$;
create or replace function public.pro_works_job(j uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.jobs where id = j and contractor_id = public.my_contractor_id())
$$;
create or replace function public.pro_on_site_job(j uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.jobs where id = j and contractor_id = public.my_contractor_id() and status in ('assigned','in_progress'))
$$;
revoke all on function public.customer_owns_job(uuid) from public, anon;
revoke all on function public.customer_owns_completed_job(uuid) from public, anon;
revoke all on function public.pro_works_job(uuid) from public, anon;
revoke all on function public.pro_on_site_job(uuid) from public, anon;
grant execute on function public.customer_owns_job(uuid), public.customer_owns_completed_job(uuid), public.pro_works_job(uuid), public.pro_on_site_job(uuid), public.is_admin() to authenticated;

-- ─── jobs and offers: no direct reads by customers or pros ──────────────────
drop policy if exists jobs_customer on public.jobs;
drop policy if exists jobs_pro on public.jobs;
drop policy if exists offers_pro on public.job_offers;

-- ─── the rules that asked "is this my job?" ─────────────────────────────────
drop policy if exists events_customer on public.job_events;
create policy events_customer on public.job_events for select to authenticated using (visible_to_customer and public.customer_owns_job(job_id));
drop policy if exists events_pro on public.job_events;
create policy events_pro on public.job_events for select to authenticated using (visible_to_customer and public.pro_works_job(job_id));

drop policy if exists messages_party_read on public.messages;
create policy messages_party_read on public.messages for select to authenticated using (public.customer_owns_job(job_id) or public.pro_works_job(job_id));
drop policy if exists messages_customer_post on public.messages;
create policy messages_customer_post on public.messages for insert to authenticated with check (sender_id = auth.uid() and sender_role = 'customer' and public.customer_owns_job(job_id));
drop policy if exists messages_pro_post on public.messages;
create policy messages_pro_post on public.messages for insert to authenticated with check (sender_id = auth.uid() and sender_role = 'pro' and public.pro_works_job(job_id));

drop policy if exists reviews_customer_post on public.reviews;
create policy reviews_customer_post on public.reviews for insert to authenticated with check (public.customer_owns_completed_job(job_id));
drop policy if exists payments_customer on public.payments;
create policy payments_customer on public.payments for select to authenticated using (public.customer_owns_job(job_id));

drop policy if exists pro_assigned on public.job_access;
create policy pro_assigned on public.job_access for select to authenticated using (public.pro_on_site_job(job_id));
drop policy if exists customer_own on public.job_access;
create policy customer_own on public.job_access for select to authenticated using (public.customer_owns_job(job_id));

-- ─── money columns: no signed-in user reads them directly (admin pages use the server) ──
do $$
declare c text; cols text;
begin
  -- jobs: everything except pro pay, the referral partner fields and AI dispatch notes
  select string_agg(quote_ident(column_name), ', ') into cols from information_schema.columns
   where table_schema = 'public' and table_name = 'jobs'
     and column_name not in ('contractor_payout','partner_id','partner_tier','partner_rate','partner_sale','partner_pro_fee','ai_dispatch');
  execute 'revoke select on public.jobs from anon, authenticated';
  execute format('grant select (%s) on public.jobs to authenticated', cols);
  -- job offers: everything except the pay offered and countered
  select string_agg(quote_ident(column_name), ', ') into cols from information_schema.columns
   where table_schema = 'public' and table_name = 'job_offers'
     and column_name not in ('payout','counter_payout','counter_note');
  execute 'revoke select on public.job_offers from anon, authenticated';
  execute format('grant select (%s) on public.job_offers to authenticated', cols);
end $$;

-- ─── payouts and partner commissions: admins only (pros still see their own payouts) ──
drop policy if exists staff_all on public.payouts;
drop policy if exists admin_all on public.payouts;
create policy admin_all on public.payouts for all to authenticated using (public.is_admin()) with check (public.is_admin());
do $$ begin
  if to_regclass('public.partner_commissions') is not null then
    execute 'drop policy if exists staff_all on public.partner_commissions';
    execute 'drop policy if exists admin_all on public.partner_commissions';
    execute 'create policy admin_all on public.partner_commissions for all to authenticated using (public.is_admin()) with check (public.is_admin())';
  end if;
end $$;
