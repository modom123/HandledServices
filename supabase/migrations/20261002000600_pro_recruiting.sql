-- ============================================================================
-- FILE    : supabase/migrations/20261002000600_pro_recruiting.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-02_0006 UTC
-- PURPOSE : Automated pro recruiting & onboarding, tracked end to end.
--             • contractor_applications: where the applicant came from (source, referral,
--               UTM), the pipeline stage, timestamps, follow-ups sent and the linked contractor
--             • contractors: invite / reminder tracking, background-check provider status
--             • contractor_documents.ai_check: AI reading of each uploaded certificate/license
--             • recruiting_events: every touch (applied, screened, invited, reminded, step done,
--               document verified, background clear, activated, dropped) — the full history
--             • recruiting_settings: auto-invite / auto-activate / reminder schedule (Hub)
--             • fix: link a pro record to an existing login with the same email (people who
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
