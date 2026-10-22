-- ============================================================================
-- FILE    : supabase/migrations/20261022100000_one_handled_account.sql
-- PROJECT : Handled (HandledServices) - AI-run home & business services
-- CREATED : 2026-10-22_1000 UTC
-- PURPOSE : ONE HANDLED ACCOUNT for everything (book, refer, get paid, work as a pro). Everyone who joins the referral
--           network gets a Handled account at sign-up (apps/web/lib/partners.ts ensureAccount), and a referral partner
--           is paid only through a linked account. This keeps the database side in step:
--             - handle_new_user(): a new account also links a referral partner record with the same email (as it
--               already does for guest bookings and pro records)
--             - backfill: existing partners linked to existing accounts by email
--           Same function body as 20261001172300_init.sql plus one line. Safe to run twice.
-- ============================================================================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  -- link guest bookings made with this email before the account existed
  update public.jobs set customer_id = new.id where customer_id is null and lower(contact_email) = lower(new.email);
  -- link an approved contractor record with this email
  update public.contractors set profile_id = new.id where profile_id is null and lower(email) = lower(new.email);
  update public.profiles set role = 'pro' where id = new.id and exists (select 1 from public.contractors where profile_id = new.id);
  -- link a referral partner record with this email (one Handled account: book, refer, get paid)
  update public.referral_partners set profile_id = new.id where profile_id is null and lower(email) = lower(new.email);
  return new;
end $$;

-- partners who joined before their account existed (or before this ran): link them now
update public.referral_partners rp set profile_id = p.id
  from public.profiles p
 where rp.profile_id is null and p.email is not null and lower(p.email) = lower(rp.email);
