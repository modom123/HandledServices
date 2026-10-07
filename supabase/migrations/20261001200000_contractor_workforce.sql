-- ============================================================================
-- FILE    : supabase/migrations/20261001200000_contractor_workforce.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-01_2000 UTC
-- PURPOSE : The subcontractor workforce — our core asset.
--             • 1099 tax profile per pro (independent contractors, never employees):
--               legal name, entity type, TIN last 4 only (the full W-9 PDF lives in
--               private storage), address, payout method
--             • onboarding: W-9, signed independent-contractor agreement, insurance
--               certificate, license (licensed trades), background check — each a
--               document with verification status and expiry
--             • ledger views: per-pro scorecard (work done, bookings generated, our take
--               from their work, quality) and 1099 totals by tax year
-- ============================================================================

alter table public.contractors
  add column legal_name text,
  add column entity_type text check (entity_type in ('individual','sole_prop','llc','s_corp','c_corp','partnership')),
  add column tin_last4 text check (tin_last4 ~ '^[0-9]{4}$'),
  add column address_line text,
  add column city text,
  add column state text,
  add column zip text,
  add column w9_received_at timestamptz,
  add column agreement_version text,
  add column agreement_signed_at timestamptz,
  add column agreement_signer text,
  add column license_expires date,
  add column background_checked_at timestamptz,
  add column payout_method text check (payout_method in ('ach','stripe_connect','check')),
  add column payout_account_last4 text,
  add column onboarded_at timestamptz,
  add column offboarded_at timestamptz,
  add column offboard_reason text,
  add column application_id uuid references public.contractor_applications(id) on delete set null;

create table public.contractor_documents (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  kind text not null check (kind in ('w9','coi','license','background','agreement','other')),
  storage_path text,
  expires_on date,
  status text not null default 'pending' check (status in ('pending','verified','rejected','expired')),
  verified_by text,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index contractor_documents_idx on public.contractor_documents(contractor_id, kind, created_at desc);

alter table public.contractor_documents enable row level security;
create policy staff_all on public.contractor_documents for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy docs_pro_read on public.contractor_documents for select to authenticated using (contractor_id = public.my_contractor_id());

insert into storage.buckets (id, name, public) values ('pro-docs', 'pro-docs', false) on conflict (id) do nothing;
create policy pro_docs_staff on storage.objects for all to authenticated
  using (bucket_id = 'pro-docs' and public.is_staff()) with check (bucket_id = 'pro-docs' and public.is_staff());

-- Per-pro scorecard: the asset view. security_invoker → RLS of the caller applies.
create view public.contractor_scorecard with (security_invoker = true) as
select
  c.id as contractor_id,
  c.business_name,
  c.status,
  c.trades,
  c.rating,
  c.acceptance_rate,
  c.on_time_rate,
  c.onboarded_at,
  count(j.id) filter (where j.status = 'completed' and j.remedy is null)                         as jobs_completed,
  count(j.id) filter (where j.status = 'completed' and j.completed_at > now() - interval '90 days' and j.remedy is null) as jobs_90d,
  count(j.id) filter (where j.remedy = 'redo')                                                    as redos,
  coalesce(sum(j.price_final) filter (where j.status = 'completed' and j.remedy is null), 0)     as bookings_generated,
  coalesce(sum(j.price_final - j.contractor_payout - j.amount_refunded) filter (where j.status = 'completed' and j.remedy is null), 0) as take_generated,
  coalesce(sum(j.price_final - j.contractor_payout - j.amount_refunded) filter (where j.status = 'completed' and j.remedy is null and j.completed_at > now() - interval '90 days'), 0) as take_90d,
  coalesce(sum(j.amount_refunded), 0)                                                             as refunds_on_their_jobs,
  count(j.id) filter (where (j.ai_qa->>'passed')::boolean is true)                               as qa_passed,
  count(j.id) filter (where j.ai_qa is not null)                                                  as qa_checked,
  max(j.completed_at)                                                                              as last_job_at
from public.contractors c
left join public.jobs j on j.contractor_id = c.id
group by c.id;

-- 1099 totals by tax year: money actually paid out, net of clawbacks.
create view public.contractor_1099 with (security_invoker = true) as
select
  c.id as contractor_id,
  c.business_name,
  c.legal_name,
  c.entity_type,
  c.tin_last4,
  c.address_line, c.city, c.state, c.zip,
  c.w9_received_at,
  extract(year from coalesce(p.paid_at, p.created_at))::int as tax_year,
  sum(p.amount) filter (where p.status in ('paid','clawback')) as paid_total,
  sum(p.amount) filter (where p.status in ('approved','pending','held')) as owed_total,
  count(*) filter (where p.status = 'paid') as payments
from public.contractors c
join public.payouts p on p.contractor_id = c.id
group by c.id, tax_year;

-- ─── Ratings on every job: the customer AND us ──────────────────────────────
-- Customer → public.reviews (stars + comment). Company → ops_ratings (staff, IEBC agent, or a
-- draft from the AI photo QA that staff can override). A pro's rating = 60% customer + 40%
-- ours over their last 50 rated jobs, and it drives dispatch ranking.
create table public.ops_ratings (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  quality int check (quality between 1 and 5),
  punctuality int check (punctuality between 1 and 5),
  professionalism int check (professionalism between 1 and 5),
  comment text,
  source text not null default 'staff' check (source in ('staff','ai_qa','iebc')),
  rated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ops_ratings enable row level security;
create policy staff_all on public.ops_ratings for all to authenticated using (public.is_staff()) with check (public.is_staff());
create trigger ops_ratings_touch before update on public.ops_ratings for each row execute function public.touch_updated_at();

create or replace function public.recompute_contractor_rating(cid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare cust numeric; ours numeric;
begin
  if cid is null then return; end if;
  select avg(rating) into cust from (select rating from public.reviews where contractor_id = cid order by created_at desc limit 50) r;
  select avg(rating) into ours from (select rating from public.ops_ratings where contractor_id = cid order by created_at desc limit 50) o;
  if cust is null and ours is null then return; end if;
  update public.contractors set rating = round(case
      when cust is not null and ours is not null then 0.6 * cust + 0.4 * ours
      else coalesce(cust, ours) end, 1)
  where id = cid;
end $$;

-- The pro on a customer review always comes from the job (never from the browser).
create or replace function public.reviews_set_contractor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select contractor_id into new.contractor_id from public.jobs where id = new.job_id;
  return new;
end $$;
create trigger reviews_set_contractor before insert or update on public.reviews for each row execute function public.reviews_set_contractor();

create or replace function public.ratings_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.recompute_contractor_rating(new.contractor_id);
  return new;
end $$;
create trigger reviews_rating_rollup after insert or update on public.reviews for each row execute function public.ratings_changed();
create trigger ops_ratings_rollup after insert or update on public.ops_ratings for each row execute function public.ratings_changed();
