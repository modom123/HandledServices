-- ============================================================================
-- FILE    : supabase/migrations/20261002015700_iebc_recruiting_roles.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-02_0157 UTC
-- PURPOSE : IEBC recruiting agents work the automated onboarding pipeline.
--             • Tyler Walsh — recruiting pipeline: screening, invites, follow-up with stuck applicants
--             • Marcus Hill — onboarding compliance: documents (with AI readings) & background checks
--           Both run low-risk actions (reminders, notes, revive, order a background check) on
--           their own; inviting, activating and verifying documents are high-risk and always
--           wait for human approval in Handled Hub → IEBC Workforce.
-- ============================================================================
update public.iebc_agents set role_here = 'Recruiting pipeline: screening, invites & follow-up with stuck applicants', autonomy = 'autonomous'
  where iebc_employee_id = 'tylerw';
update public.iebc_agents set role_here = 'Onboarding compliance: insurance & license documents, background checks', autonomy = 'autonomous'
  where iebc_employee_id = 'marcushr';
