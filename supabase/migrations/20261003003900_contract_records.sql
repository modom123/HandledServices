-- ============================================================================
-- FILE    : supabase/migrations/20261003003900_contract_records.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-03_0039 UTC
-- PURPOSE : Every contract a customer, business or pro accepts — with a frozen copy of the exact
--           text they agreed to (sections + SHA-256 hash), when, how (booking, e-signature,
--           checkout), and from where. Shown in each person's account ("My contracts"), in the
--           pro portal, and in Hub → Contract library. Kept after account deletion (legal record);
--           the profile link is cleared, the email stays.
-- ============================================================================

create table if not exists public.contract_acceptances (
  id uuid primary key default gen_random_uuid(),
  contract_key text not null,
  version text not null,
  title text not null,
  audience text not null check (audience in ('customer','business','pro')),
  profile_id uuid references public.profiles(id) on delete set null,
  contractor_id uuid references public.contractors(id) on delete set null,
  email text,
  signer_name text,
  job_id uuid references public.jobs(id) on delete set null,
  method text not null default 'click' check (method in ('booking','signature','checkout','click')),
  ip text,
  user_agent text,
  sections jsonb not null,
  content_hash text not null,
  accepted_at timestamptz not null default now()
);
alter table public.contract_acceptances enable row level security;
create index if not exists contract_acceptances_profile_idx on public.contract_acceptances (profile_id, accepted_at desc);
create index if not exists contract_acceptances_contractor_idx on public.contract_acceptances (contractor_id, accepted_at desc);
create index if not exists contract_acceptances_email_idx on public.contract_acceptances (lower(email));
create index if not exists contract_acceptances_key_idx on public.contract_acceptances (contract_key, version);

-- People read their own records (written by the server only).
create policy "own contracts" on public.contract_acceptances for select using (
  profile_id = auth.uid()
  or contractor_id in (select id from public.contractors where profile_id = auth.uid())
);
