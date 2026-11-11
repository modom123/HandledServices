<!--
  FILE    : docs/NEED_TO_KNOW_ACCESS_2026-11-06_1900.md
  PROJECT : Handled (HandledServices) — AI-run home & business services
  CREATED : 2026-11-06_1900 UTC
  PURPOSE : Who can see what (need-to-know), how it's enforced in the database and the app, and how to turn it on.
-->

# Need-to-know access

**Only admins see everything.** Everyone else sees what their job needs.

| Who | Sees | Never sees |
|---|---|---|
| **Admin** | Everything: prices, pro pay, Handled's take, referral splits, commissions, payouts (Hub, read on the server) | — |
| **Dispatcher** (staff, not admin) | Jobs, customers, prices, schedules, pros, offers (without pay), messages | Pro pay, offer pay, Handled's take, partner fields and commissions, payouts, AI dispatch notes. Money pages, Partners and money stats show "Admins only" |
| **Pro** | Their offers and jobs: what the work is, when and where, the customer's name, phone and address once the job is theirs, the customer-facing timeline, and **their net pay** | Job price, Handled's take, the referral split, the customer's email, internal notes, other pros' anything |
| **Customer** | Their own bookings, price, payments, timeline and messages | Pro pay, partner data, internal AI notes, internal timeline notes, other customers' anything |

## How it's enforced
**Database** (`supabase/migrations/20261106190000_need_to_know.sql`):
- Customers and pros can't read `jobs` or `job_offers` directly. The site and the app read them through the server
  (`apps/web/lib/job-access.ts`, the endpoints `/api/account/jobs`, `/api/account/jobs/[id]`, `/api/pro/jobs`,
  `/api/pro/jobs/[id]` and `/api/pro/offers`), which checks ownership and returns only what that person needs.
- No signed-in user can read the money columns directly: pro pay (`jobs.contractor_payout`), the referral partner
  fields, AI dispatch notes, offer pay. Admin pages read them on the server with the service key.
- Payouts and partner commissions are admin-only (pros still see their own payouts, their net pay).
- The "is this my job?" checks for messages, the timeline, payments, entry details and reviews use small
  security-definer functions. Pros see only the customer-facing timeline.
- **New columns** on `jobs` or `job_offers` are hidden from signed-in users until they're added to the grant in a
  migration. This fails closed, and server reads are unaffected.

**App and site:** the Hub reads on the server and shows money only to admins. That covers the job money card, offer
pay, the dashboard Money tiles, a pro's take, 1099 and payout ledger, the Money and Partners pages, and the revenue,
payments and payouts histories. The mobile app reads through the API and refreshes on a timer where it used to get
live database updates for jobs and offers. The timeline and messages are still live.

Tested on Postgres 16 with every migration applied: customer, pro, dispatcher, admin, another customer, and the
service key, plus message posting and running the migration twice.

## Turning it on (order matters)
1. Deploy the website and publish the app update. Both read jobs through the server.
2. Then run `supabase/setup/ADD_NEED_TO_KNOW_ACCESS_2026-11-06_1900.sql` in Supabase → SQL Editor.
   Older app versions still on phones will show empty job lists until updated, so ship the app first.
3. Hub → Go-live setup shows a red item until the SQL is run.

IEBC AI employees use the server API with their own scopes (finance actions need the finance scope and approval),
so they're unchanged.
