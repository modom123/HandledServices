-- ============================================================================
-- FILE    : supabase/setup/HANDLED_UPDATE_TODAY_2026-10-06_1910.sql
-- PROJECT : Handled (myhumanai)
-- CREATED : 2026-10-06_1910 UTC
-- PURPOSE : Today's database changes for an EXISTING Supabase project (one that already ran the
--           earlier setup). Safe to run more than once. Runs as one transaction: all or nothing.
--             1. app_payments        — in-app (Apple Pay / Google Pay) payment ids
--             2. lock_down_rpc       — internal database functions callable by the server only
--             3. agent_tasks         — tasks assigned to the AI agents (Hub → AI agents)
--             4. business_rfp_scope  — scope of work from the Request a proposal form
--           Supabase → SQL Editor → New query → paste this whole file → Run.
--           NEW (empty) project instead? Use HANDLED_SETUP_2026-10-06_1900.sql — it includes all of this.
-- ============================================================================
begin;

-- >>> migration 20261006070800_app_payments.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261006070800_app_payments.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-06_0708 UTC
-- PURPOSE : In-app payments (Apple Pay, Google Pay, card via Stripe PaymentSheet): a payment row
--           remembers its PaymentIntent, so the webhook can settle it and support can look it up.
-- ============================================================================
alter table public.payments add column if not exists stripe_payment_intent_id text;
create index if not exists payments_stripe_payment_intent_idx on public.payments (stripe_payment_intent_id) where stripe_payment_intent_id is not null;

-- >>> migration 20261006072600_lock_down_rpc.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261006072600_lock_down_rpc.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-06_0726 UTC
-- PURPOSE : Security (defense in depth): functions that run with elevated rights (security definer) are
--           not callable from the app unless they're meant to be. Supabase exposes the public schema as
--           RPC, so an un-revoked function can be called with the public (anon) key.
--             • recompute_contractor_rating(cid) — was callable by anyone (it only recomputes from existing
--               reviews, so harmless, but it isn't the app's business). Now server-only.
--             • draw_promo_balance(code, amount) — already revoked in launch_growth; re-asserted here and
--               granted explicitly to the server (service_role) so it can't be lost by accident.
--           Helpers that only answer about the caller (is_staff, app_role, my_contractor_id) and the
--           customer's own-job lookups (job_pro, job_crew) stay callable by signed-in users.
--           New functions in this schema are no longer executable by anonymous users by default.
-- ============================================================================
revoke all on function public.draw_promo_balance(text, numeric) from public, anon, authenticated;
grant execute on function public.draw_promo_balance(text, numeric) to service_role;

revoke all on function public.recompute_contractor_rating(uuid) from public, anon, authenticated;
grant execute on function public.recompute_contractor_rating(uuid) to service_role;

alter default privileges in schema public revoke execute on functions from public, anon;

-- >>> migration 20261006075200_agent_tasks.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261006075200_agent_tasks.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-06_0752 UTC
-- PURPOSE : Tasks the team assigns to the AI agents (Hub → AI agents, or by asking the Ops co-pilot).
--           Each open task is added to that agent's instructions on every run (packages/core/src/mission.ts),
--           and the morning brief reports progress on all of them. agent = the agent's kind
--           (concierge, dispatch, daily_brief…) or 'all' for every agent. Staff only.
-- ============================================================================
create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  agent text not null check (agent ~ '^[a-z_]{2,40}$'),
  title text not null check (char_length(title) between 3 and 300),
  target text check (target is null or char_length(target) <= 200),
  due_date date,
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  note text check (note is null or char_length(note) <= 1000),
  created_by text,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists agent_tasks_open on public.agent_tasks (agent) where status = 'open';

alter table public.agent_tasks enable row level security;
drop policy if exists staff_all on public.agent_tasks;
create policy staff_all on public.agent_tasks for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- >>> migration 20261006084100_business_rfp_scope.sql
-- ============================================================================
-- FILE    : supabase/migrations/20261006084100_business_rfp_scope.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-06_0841 UTC
-- PURPOSE : The business Request for Proposal keeps its scope of work as structured data (packages/core/src/rfp.ts):
--           square footage, site, each service with how often and specifics, working hours, current vendor, term,
--           decision process (and bid due date), walkthrough times, preferred contact. The Hub shows it with a
--           follow-up checklist of what's still missing.
-- ============================================================================
alter table public.business_accounts
  add column if not exists rfp_scope jsonb,
  add column if not exists preferred_contact text check (preferred_contact is null or preferred_contact in ('call','email','text'));

commit;
