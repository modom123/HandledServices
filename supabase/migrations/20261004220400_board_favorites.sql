-- ============================================================================
-- FILE    : supabase/migrations/20261004220400_board_favorites.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-04_2204 UTC
-- PURPOSE : Open job board, customer favorites and crew member requests (packages/core/src/board.ts).
--             • job_offers.kind adds 'favorite' (a customer's favorite pro gets a first look) and
--               'board' (a pro claimed the job from "Jobs near you"; held while they read the work order)
--             • customer_favorites — any customer can favorite a pro, or a crew member of a pro company
--             • jobs.preferred_contractor_id / requested_crew_member_id — "Book again with …": the pro
--               gets a first look (never guaranteed); a crew member request goes to the company owner,
--               who decides who goes
--             • job_crew(job) — the customer's safe view of the crew member assigned to their job
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

-- Who from the company is coming? First name and role only — for the customer on that job.
create or replace function public.job_crew(p_job uuid)
returns table (crew_member_id uuid, first_name text, role text)
language sql stable security definer set search_path = public as $$
  select m.id, split_part(m.full_name, ' ', 1), m.role
  from public.jobs j join public.crew_members m on m.id = j.crew_member_id
  where j.id = p_job and (j.customer_id = auth.uid() or public.is_staff())
$$;
grant execute on function public.job_crew(uuid) to authenticated;
