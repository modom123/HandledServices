-- ============================================================================
-- FILE    : supabase/setup/ADD_PARTNER_TICKETS_2026-10-28_0122.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-10-28_0122 UTC
-- PURPOSE : ONE paste for the EXISTING Supabase project: Referral Partner Program v2 — fixed earnings tiers
--           (25% one-time / 10% repeat / 15% account, split 50/50 pro and Handled) and the standard referral ticket.
--           Same as migration 20261028012200_partner_tickets_tiers.sql. Needs the Partner Program tables
--           (ADD_REFERRAL_PARTNERS_2026-10-07_0100.sql, already in the full setup).
--           Safe to run twice. Supabase -> SQL Editor -> New query -> paste this whole file -> Run.
-- ============================================================================
alter table public.referral_customers add column if not exists ticket_no text;
alter table public.referral_customers add column if not exists job_type text;
alter table public.referral_customers add column if not exists address text;
alter table public.referral_customers add column if not exists city text;
alter table public.referral_customers add column if not exists zip text;
alter table public.referral_customers add column if not exists company text;
alter table public.referral_customers add column if not exists contact_pref text;
alter table public.referral_customers add column if not exists best_time text;
alter table public.referral_customers add column if not exists timing text;
alter table public.referral_customers add column if not exists preferred_date date;
alter table public.referral_customers add column if not exists details text;
alter table public.referral_customers add column if not exists relationship text;
alter table public.referral_customers add column if not exists consent_at timestamptz;
alter table public.referral_customers add column if not exists status text not null default 'submitted';
alter table public.referral_customers add column if not exists staff_note text;
alter table public.referral_customers add column if not exists updated_at timestamptz not null default now();
alter table public.referral_customers drop constraint if exists referral_customers_status_check;
alter table public.referral_customers add constraint referral_customers_status_check check (status in ('submitted','contacted','closed'));
alter table public.referral_customers drop constraint if exists referral_customers_job_type_check;
alter table public.referral_customers add constraint referral_customers_job_type_check check (job_type is null or job_type in ('one_time','recurring','account'));
create unique index if not exists referral_customers_ticket_no_idx on public.referral_customers (ticket_no) where ticket_no is not null;

alter table public.partner_commissions add column if not exists tier text;
alter table public.partner_commissions add column if not exists rate numeric(5,4);
alter table public.partner_commissions add column if not exists from_pro numeric(12,2) not null default 0;
alter table public.partner_commissions add column if not exists from_us numeric(12,2) not null default 0;
alter table public.partner_commissions add column if not exists pro_returned numeric(12,2) not null default 0;
alter table public.partner_commissions drop constraint if exists partner_commissions_tier_check;
alter table public.partner_commissions add constraint partner_commissions_tier_check check (tier is null or tier in ('one_time','repeat','account','legacy'));

alter table public.jobs add column if not exists partner_tier text;
alter table public.jobs add column if not exists partner_pro_fee numeric(12,2) not null default 0;
alter table public.jobs drop constraint if exists jobs_partner_tier_check;
alter table public.jobs add constraint jobs_partner_tier_check check (partner_tier is null or partner_tier in ('one_time','repeat','account'));

alter table public.payouts drop constraint if exists payouts_kind_check;
alter table public.payouts add constraint payouts_kind_check
  check (kind in ('job','show_up','guarantee','stipend','materials','clawback','referral','tip','placement','partner_fee'));
