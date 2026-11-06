<!--
  FILE    : docs/NEW_MARKETS_NY_NJ_LAS_VEGAS_2026-11-06_0234.md
  PROJECT : Handled (HandledServices) — AI-run home & business services
  CREATED : 2026-11-06_0234 UTC
  UPDATED : 2026-11-06_0311 UTC — contracts drafted (state addenda); see STATE_CONTRACTS_NY_NJ_NV_2026-11-06_0311.md.
  PURPOSE : What opening New York, New Jersey and the Las Vegas area changed in the app, how to switch it on, and the
            registrations, licenses and taxes to sort out before taking money there.
-->
# New markets: New York, New Jersey and the Las Vegas area

## What changed in the app

| Area | ZIPs | Time zone | Service areas and price level (vs Michigan = 1.00) |
|---|---|---|---|
| **New York** (statewide) | 100–149 | Eastern | **New York City**: Manhattan, Brooklyn, Queens and the Bronx 1.35, Staten Island 1.30. **Suburbs**: Westchester & Rockland 1.30, Long Island 1.30. **Upstate**: Hudson Valley 1.15, Capital Region & North Country 1.05, Central NY & Southern Tier 1.00, Western NY (Buffalo & Rochester) 1.00. |
| **New Jersey** (statewide) | 070–089 | Eastern | North Jersey 1.20 · Central Jersey & the Shore 1.15 · South Jersey 1.10 |
| **Nevada: the Las Vegas area only** | 889–891 | Pacific | Las Vegas Valley (with Henderson, North Las Vegas, Boulder City) 1.10 · Southern Nevada (Pahrump, Mesquite, Laughlin) 1.10. **Reno and northern Nevada stay on the waitlist.** |

- **Code:**
  - `apps/web/lib/launch.ts` (`SERVED_STATES`) opens the ZIP ranges.
  - `packages/core/src/roster.ts` puts Nevada on Pacific time.
  - `SERVED_AREAS` in `packages/core/src/brand.ts` is now the one wording for "where we serve". It's used by the booking messages, the splash badge and the About page.
- **Business leads:** job-posting searches and Places discovery now include NY, NJ and Las Vegas cities.
  - The city rotation now spreads across all five areas, so Michigan gets fewer of each day's discovery slots.
- **Price levels:** these are **my starting estimates, not market research**. Change them in Supabase → `markets.price_multiplier`. The pro's pay follows the price.
- **Tests:** 2 new tests cover Las Vegas/NY/NJ time zones and New York City pricing. All 121 tests pass, and the typecheck is clean.

## Switch it on
1. Deploy this branch.
2. In Supabase → SQL Editor, run `supabase/setup/ADD_NY_NJ_LAS_VEGAS_SERVICE_AREAS_2026-11-06_0234.sql`. It adds the 16 service areas and is safe to run twice.
3. Recruit and approve pros in each area (Indeed posts for NYC, North Jersey and Las Vegas).

**Read this before deploying.** The Hub → Dispatch switch "Take bookings where no pro covers the area yet" is **on by default**. While it's on, customers in all three new areas can **book and pay right away**, before any pro covers them. Turn it **off** until the registrations below are done and pros are approved there. Customers then join the waitlist instead, and are told when their area opens.

## Before taking money there (owner / accountant / lawyer)

These are summaries to confirm with a professional, not legal advice.

### New York
- **Register the LLC:** file an Application for Authority with the NY Department of State. Foreign LLCs must also complete the **publication requirement** within 120 days.
- **Sales tax:**
  - Get a NY Certificate of Authority **before** selling taxable services.
  - NY taxes many of our services: cleaning and maintenance of buildings, lawn and landscape maintenance, snow removal, pest control, and repairs to items.
  - Capital improvements are not taxed.
  - **Turn on Stripe Tax** (`STRIPE_TAX=on`) first. The Hub readiness page now warns about this.
- **Home improvement licenses:**
  - New York City requires a **DCWP Home Improvement Contractor license**.
  - Nassau, Suffolk, Westchester, Rockland and Putnam counties have their own.
  - Because Handled sells the job to the homeowner, Handled itself likely needs one, as well as the pros.
- **Freelance Isn't Free Act** (statewide): written contract for freelance work of $800 or more, and payment on time. Check the pro agreement against it.

### New Jersey
- **Register the LLC:** foreign LLC registration and a NJ Business Registration Certificate with the Division of Revenue.
- **Sales tax:**
  - NJ taxes many services: cleaning of buildings, landscaping, home repair and maintenance, and pest control.
  - Capital improvements are exempt with form ST-8.
  - Register, and turn on Stripe Tax first.
- **Home Improvement Contractor registration:** required with the NJ Division of Consumer Affairs, for Handled and for its pros.
  - Home improvement contracts over $500 need specific written terms and a **3-day right to cancel**.
- **Worker classification:** NJ uses the strict **ABC test**. Have a NJ employment lawyer review the 1099 pro model before launch. This is the biggest legal risk of the three states.

### Nevada (Las Vegas area)
- **Register the LLC:** foreign LLC filing with the NV Secretary of State and a **State Business License** ($200 a year).
- **Local business licenses:** Clark County, City of Las Vegas, Henderson and North Las Vegas each issue their own.
- **Contractor license:** the **Nevada State Contractors Board** requires one for almost all construction and repair work.
  - The handyman exemption is narrow: under $1,000 in total, no permit, and not advertised as contracting.
  - Vet pros' NSCB licenses. Pest control needs a NV Department of Agriculture license.
- **Taxes:** Nevada generally **does not tax services**. Materials sold are taxable. The Commerce Tax applies only above $4M of Nevada revenue.

### Contracts and vetting (all three states)
- **Contracts:** drafted 2026-11-06 as state addenda (`apps/web/lib/contracts/state.ts`, Spanish in `es-state.ts`). See `docs/STATE_CONTRACTS_NY_NJ_NV_2026-11-06_0311.md`. **A lawyer licensed in each state must review them before you take bookings there.**
- **Vetting:** trade license notes in `packages/core/src/vetting.ts` describe Michigan (LARA) and some Washington (L&I) rules. Until they're updated, staff should check NY/NYC, NJ and NSCB licenses by hand during pro approval.
- **SEO:** no "service in city" pages were added for the new areas. Add cities to `packages/core/src/seo.ts` once pros cover them.
