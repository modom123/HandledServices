-- ============================================================================
-- FILE    : supabase/setup/ADD_TICKET_INVITES_2026-10-22_0700.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-22_0700 UTC
-- UPDATED : 2026-10-22_0800 UTC - pros and partners send invites too (invited_by_partner_id: who brought them into the network).
-- PURPOSE : One paste in Supabase → SQL Editor → Run, AFTER ADD_REFERRAL_TICKETS_2026-10-22_0400.sql
--           (same as migrations/20261022070000_ticket_invites.sql).
--           Referral TICKET INVITES. Someone we speak with on the phone (a call desk lead, a customer, a contractor)
--           gets a personal link by text and/or email. It opens the Standard Referral Ticket with their own details
--           already filled in; submitting it sends us the job AND signs them up as a referral partner (their Handled
--           account is created from the welcome email), so they join the network. They can also just join with no job
--           yet, and apply as a pro from the same link. Rules: apps/web/lib/ticket-invites.ts.
--             ticket_invites - who we invited, how (email / text, with their consent on the call), and what came of it:
--                              sent -> opened -> completed (joined; ticket_id when they sent a job) / expired
--           Staff read/write through the Hub; the invitee only through their link (server). Safe to run twice.
-- ============================================================================
create table if not exists public.ticket_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,                 -- the personal link (/ticket/…)
  name text not null,
  email text,                                 -- lower-case
  phone text,
  company text,
  kind text not null default 'other',         -- what they are (referral_partners.kind values)
  job_hint text,                              -- what they mentioned on the call (starts the ticket's description)
  sent_by text not null,                      -- staff email or "<agent> (IEBC)"
  via_email boolean not null default false,
  via_sms boolean not null default false,
  sms_consent boolean not null default false, -- they agreed on the call to get this by text
  status text not null default 'sent' check (status in ('sent','opened','completed','expired','cancelled')),
  opened_at timestamptz,
  completed_at timestamptz,
  partner_id uuid references public.referral_partners(id) on delete set null,
  ticket_id uuid references public.referral_tickets(id) on delete set null,
  biz_lead_id uuid,                           -- the Call desk lead it was sent from, if any
  invited_by_partner_id uuid references public.referral_partners(id) on delete set null,  -- a pro or partner sent it (null = Handled staff / IEBC)
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.ticket_invites add column if not exists invited_by_partner_id uuid references public.referral_partners(id) on delete set null;  -- for databases that ran the first version
create index if not exists ticket_invites_by_partner_idx on public.ticket_invites (invited_by_partner_id, created_at desc) where invited_by_partner_id is not null;
create index if not exists ticket_invites_status_idx on public.ticket_invites (status, created_at desc);
create index if not exists ticket_invites_email_idx on public.ticket_invites (email);

alter table public.ticket_invites enable row level security;
drop policy if exists staff_all on public.ticket_invites;
create policy staff_all on public.ticket_invites for all to authenticated using (public.is_staff()) with check (public.is_staff());
