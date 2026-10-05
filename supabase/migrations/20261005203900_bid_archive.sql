-- ============================================================================
-- FILE    : supabase/migrations/20261005203900_bid_archive.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-05_2043 UTC
-- PURPOSE : RFP / RFQ archive and resubmission (bid engine, Hub → Bids).
--             • bids: solicitation type (RFQ, RFP, IFB…), revision number, reopened for a revision (when / why),
--               and the earlier bid it was copied from (next year's re-bid)
--             • bid_documents: versions — replacing a file keeps the old one (superseded, never deleted)
--             • bid_submissions: every time a bid is submitted, a frozen record: number, reason, what changed, the
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
begin raise exception 'Submission records are permanent — submit a new version instead'; end $$;
drop trigger if exists bid_submission_frozen on public.bid_submissions;
create trigger bid_submission_frozen before update on public.bid_submissions for each row execute function public.bid_submission_frozen();
