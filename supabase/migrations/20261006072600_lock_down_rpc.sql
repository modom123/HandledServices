-- ============================================================================
-- FILE    : supabase/migrations/20261006072600_lock_down_rpc.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
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
