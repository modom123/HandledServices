-- ============================================================================
-- FILE    : supabase/setup/TURN_ON_RECRUITING_2026-10-03_0315.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-03_0315 UTC
-- PURPOSE : Turn on automatic pro recruiting in production (paste into Supabase → SQL editor, run once,
--           AFTER all migrations — incl. 20261003020600_pro_lead_engine.sql):
--             • auto-invite: applicants the AI screen scores 70+ (and doesn't flag) get their setup link
--               automatically; pros are activated as soon as every step is verified
--             • lead engine: on, LEAN setup — 5 Google searches and 20 new leads a day handed to Instantly.
--               With the 3-step sequence that's ~60 emails/day, what 2 warmed-up inboxes send safely
--               (~$50–60/month all-in). Raise the caps in Hub → Pro leads (and add inboxes) once
--               bounces stay under ~3% and you want more applicants.
--           The engine only hands leads to Instantly once INSTANTLY_API_KEY, INSTANTLY_CAMPAIGN_ID and
--           BUSINESS_POSTAL_ADDRESS are set in Vercel, and only searches once GOOGLE_PLACES_API_KEY is.
-- UPDATED : 2026-10-03_0325 UTC — sending through Instantly (emails/day = new leads handed to Instantly per day).
-- UPDATED : 2026-10-03_0329 UTC — lean caps: 5 searches/day, 20 new leads/day (2 inboxes).
-- ============================================================================

-- Recruiting: auto-invite + auto-activate on (keeps any other saved settings)
insert into public.recruiting_settings (id, settings, updated_by)
values (1, '{"autoInvite": true, "minScore": 70, "autoActivate": true}'::jsonb, 'setup script')
on conflict (id) do update
  set settings = public.recruiting_settings.settings || '{"autoInvite": true, "minScore": 70, "autoActivate": true}'::jsonb,
      updated_at = now(), updated_by = 'setup script';

-- Lead engine: on, conservative caps; launch trades first (cleaning, handyman/carpentry, licensed trades)
insert into public.lead_engine_settings (id, enabled, discover_per_day, emails_per_day, min_rating, min_reviews, trades, updated_by)
values (1, true, 5, 20, 4.3, 5, array['cleaning','handyman','remodel','plumbing','electrical'], 'setup script')
on conflict (id) do update
  set enabled = true, discover_per_day = 5, emails_per_day = 20, min_rating = 4.3, min_reviews = 5,
      trades = array['cleaning','handyman','remodel','plumbing','electrical'], updated_at = now(), updated_by = 'setup script';

-- Check
select 'recruiting' as what, settings::text as value from public.recruiting_settings where id = 1
union all
select 'lead engine', format('enabled=%s searches/day=%s emails/day=%s trades=%s', enabled, discover_per_day, emails_per_day, trades) from public.lead_engine_settings where id = 1;
