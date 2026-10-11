<!--
  FILE    : docs/3_LAKES_CARRIER_PARTNER_2026-10-11_1405.md
  PROJECT : Handled (HandledServices) — AI-run home & business services
  CREATED : 2026-10-11_1405 UTC
  PURPOSE : How 3 Lakes Logistics joins Handled as a carrier partner (step 1: a pro company in Handled's dispatch),
            and what step 2 (connecting the two systems) needs first.
-->

# 3 Lakes Logistics — carrier partner setup

3 Lakes joins Handled the same way any pro company does: one company record, its drivers added as crew, and
Handled's dispatch offering it the jobs its trades cover. 3 Lakes dispatch accepts offers in the Handled pro portal
(or app) and assigns a driver. Customers get Handled's tracking, photos, checklists and receipts; 3 Lakes is paid
through Handled's normal weekly payouts.

## What 3 Lakes will be offered

| Handled service | Trade | 3 Lakes fleet |
|---|---|---|
| Freight & Pallet Delivery (new) | freight | CDL fleet: box trucks and 53-ft truckloads |
| Large-Item Delivery, Small Moves, Staging Moves | hauling | Cargo vans / box trucks |
| Same-Day Courier, Errands | errands | Light Fleet courier |
| Medical Deliveries | medical_courier | Light Fleet NEMT (specimens and prescriptions — packages, not patients) |
| Private Driver, Airport Transfer, Urgent Ride | transportation | Light Fleet executive |

Medicaid NEMT rides stay with 3 Lakes and are not booked through Handled.

## Setup (about an hour, plus document review)

1. **Run the setup script** — Supabase → SQL Editor → paste `supabase/setup/ADD_3_LAKES_CARRIER_PARTNER_2026-10-11_1405.sql`
   → Run (PART 1 only). This adds cargo insurance as a document type and creates the 3 Lakes company record in
   "vetting" (no job offers yet).
2. **3 Lakes signs in** at `/login` with **dispatch@3lakeslogistics.com** (choose "I'm a pro") and completes onboarding:
   W-9, the independent contractor agreement, specialties, base address and radius, and payout method.
3. **3 Lakes uploads documents** in onboarding; staff verify them in Hub → Hiring & pros → 3 Lakes Logistics:
   - General liability certificate ($1M), Handled named as additional insured
   - Commercial auto ($1M combined single limit)
   - Motor truck cargo ($100K per load) — required for freight
   - Passenger carrier auto liability ($1.5M up to 15 seats) — required for rides
   - Workers' comp (3 Lakes has employees)
   - License number = the **USDOT number**, checked on FMCSA SAFER (authority active, insurance on file). The site
     currently shows USDOT/MC as pending — freight can't be offered until authority is active.
   - HIPAA training certificate for drivers doing medical deliveries
4. **Add drivers as crew** (pro portal → Crew): each driver's name and phone, so customers see who is coming.
5. **Approve** in the Hub (admin). Then run PART 2 of the setup script so truckloads over $750 aren't held back by
   the new-pro limit.
6. **Capacity**: the record starts at 20 jobs a day within 100 miles of its base. Change it in Hub → Hiring & pros.

## Business terms to put in writing

- A carrier agreement between Handled Services LLC and 3 Lakes Logistics: rates (Handled's sliding pro pay, or a
  negotiated freight rate), payment timing, liability for cargo loss and damage, and insurance minimums. Even with
  shared owners, an arm's-length agreement keeps the books, taxes and insurance clean.
- Who handles claims: 3 Lakes' cargo insurer for freight damage; Handled's remedy flow for the customer.

## Step 2 (later): connect the two systems

When 3 Lakes accepts a Handled job, Handled would create the trip in 3 Lakes' system (`POST /trips` on the 3 Lakes
backend) so drivers see it in the Falcon app, and 3 Lakes would send status and proof of delivery back to Handled.

**Fix first:** the 3 Lakes repository is public and its API accepts keys written into the code
(`backend/app/api/deps.py` legacy token, `backend/app/settings.py` default `bond_api_key`). Rotate both keys, move
every secret to environment variables, and make the repository private before Handled sends it customer addresses.
