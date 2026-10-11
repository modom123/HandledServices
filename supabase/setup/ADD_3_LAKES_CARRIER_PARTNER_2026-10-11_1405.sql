-- ============================================================================
-- FILE    : supabase/setup/ADD_3_LAKES_CARRIER_PARTNER_2026-10-11_1405.sql
-- PROJECT : Handled Services LLC (HandledServices)
-- CREATED : 2026-10-11_1405 UTC
-- PURPOSE : Adds 3 Lakes Logistics as a carrier partner (a pro company) so Handled's dispatch can offer it freight,
--           courier, medical delivery, ride and large-item delivery jobs. Same as migration
--           20261011140500_freight_cargo_coverage.sql plus the 3 Lakes company record.
--           Run PART 1 once in Supabase -> SQL Editor. Safe to run twice.
--           Run PART 2 only after Hub -> Hiring & pros -> 3 Lakes Logistics shows every onboarding step done.
--           Guide: docs/3_LAKES_CARRIER_PARTNER_2026-10-11_1405.md
-- ============================================================================

-- ── PART 1: cargo insurance documents + the 3 Lakes company record ──────────────────────────────────────────────
alter table public.contractor_documents drop constraint if exists contractor_documents_kind_check;
alter table public.contractor_documents add constraint contractor_documents_kind_check
  check (kind in ('w9','coi','license','background','agreement','auto','workers_comp','bond','liquor','passenger_auto','cargo','certification','skills','other'));

-- Starts in "vetting": no job offers until insurance, authority, W-9, agreement and payout are verified in the Hub.
-- dispatch@ signs in at /login and completes the pro onboarding; it becomes the company's pro portal login.
insert into public.contractors (business_name, contact_name, email, phone, trades, status, daily_capacity, service_radius_mi, notes)
values (
  '3 Lakes Logistics', 'Mark Odom', 'dispatch@3lakeslogistics.com', '(661) 466-9932',
  array['freight', 'hauling', 'errands', 'medical_courier', 'transportation'],
  'vetting', 20, 100,
  'Carrier partner (3 Lakes Logistics): CDL fleet for Freight & Pallet Delivery, Light Fleet for courier, medical delivery, rides and large-item delivery. Jobs go to 3 Lakes dispatch, which assigns its own drivers (add them as crew). Medicaid NEMT rides stay with 3 Lakes, not Handled. Verify: USDOT/MC on FMCSA SAFER, commercial auto $1M, cargo $100K, passenger carrier auto for rides, HIPAA training for medical delivery.'
)
on conflict (email) do update
  set trades = (select array(select distinct unnest(public.contractors.trades || excluded.trades))),
      notes = excluded.notes,
      daily_capacity = greatest(public.contractors.daily_capacity, excluded.daily_capacity),
      service_radius_mi = greatest(public.contractors.service_radius_mi, excluded.service_radius_mi);

-- ── PART 2 (later): fast-track an established carrier past the new-pro job-size limit ──────────────────────────
-- New pros can't take jobs over $750 for their first 3 jobs; most truckloads cost more. Uncomment and run once
-- 3 Lakes is verified and approved in the Hub (Hub -> Hiring & pros -> Approve does the approval itself).
-- update public.contractors set tier_floor = 'pro_plus' where email = 'dispatch@3lakeslogistics.com' and status = 'approved';
