-- ============================================================================
-- FILE    : supabase/migrations/20261110230000_iebc_social_scope.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-11-10_2300 UTC
-- PURPOSE : Samantha Lee (Brand & Social) gets the new "social" scope: the posting calendar, drafts, edits, the AI
--           week writer and opted-in new pros to announce (apps/web/lib/iebc/team-actions.ts). Approving a post publishes
--           it, so that always waits for a person. For databases that already ran 20261110223000_iebc_team_expansion.
-- ============================================================================
update public.iebc_agents set scopes = array(select distinct unnest(scopes || array['social']))
  where iebc_employee_id = 'samantha' and not ('social' = any(scopes));
