<!--
  FILE    : docs/HANDLED_POINTS_LOYALTY_2026-10-07_0530.md
  PROJECT : Handled (myhumanai) — AI-run home & business services
  CREATED : 2026-10-07_0530 UTC
  PURPOSE : How Handled Points (customer and business loyalty) works, how to turn it on, and what it costs.
-->

# Handled Points

Every account keeps a points balance:
- **Customers:** tracked by their login and email, so points from bookings made before signing up still count.
- **Business accounts:** one shared balance for the company.
- **Pros:** already have their own program (Pro Rewards, /pro/rewards).

| Rule | Setting |
|---|---|
| Earn | **1 point per $1** paid on a completed job (tips and refunds don't count) |
| Tiers (points earned in the last 12 months) | Member 1× · **Silver** 1,000+ → 1.25× · **Gold** 3,000+ → 1.5× |
| Bonuses | +100 on the first completed job · +25 for rating the pro |
| Pending | 30 days (the make-it-right window). A refund lowers the points; a cancelled or fully refunded job earns none. Unpaid jobs wait until paid. |
| Redeem | Blocks of **500 points = $5 credit code**, used at checkout like a gift card |
| Expire | After 18 months with no completed job |
| Business accounts | Jobs booked on the business account earn for the company. Any member can see the balance; only admins redeem. |

**Cost:** about 1% back (1.5% at Gold), roughly 3.5–5% of our take. Credits come out of our share, so the pro's pay never changes.
Every number can be changed in Hub → 🏅 Handled Points → Settings (admin). Changes only affect points earned from then on.

## Where it shows
- **/account:** balance, tier and progress to the next tier, pending points, unused credit codes, "Turn into credit", activity history, and the rules.
- **/account/business:** the same card for each business account.
- **App:** `/api/account/me` returns `points` (available, pending, worth, tier). `/api/account/loyalty` returns full detail (GET) and redeems (POST).
- **Hub → 🏅 Handled Points:**
  - Every account's balance.
  - Liability: what the points are worth if all are redeemed.
  - Credit redeemed so far.
  - Adjust an account's points (for goodwill or corrections).
  - Settings.
  - Release due points now.

## How it runs
1. **A job is completed** (`finalizeJob`). Pending points are recorded for the account that booked it. A first-job bonus is added if this is the account's first job.
2. **The daily sweep cron** (`releaseLoyalty`) handles due points:
   - Points past 30 days are re-checked against refunds and cancellations, then made available.
   - The customer gets a push notification.
   - A review bonus is added if they rated the pro.
   - Balances with no completed job in 18 months expire.
3. **Redeem:**
   - The database function `redeem_loyalty` locks the account, checks the balance, and in one step writes the credit code (`promo_codes`, source `loyalty`) and the negative ledger row. Points can't be spent twice.
   - The code is emailed to the customer and works at checkout like a gift card.

## Turn it on
Supabase → SQL Editor → run `supabase/setup/ADD_LOYALTY_POINTS_2026-10-07_0530.sql` once. It's safe to run twice.
Until it's run, balances show 0, and job completion and the cron skip points without errors.

## Accounting
A redeemed credit is a discount funded by us, just like referral credits. When a credit is used at checkout, it is recorded as a gift-card/credit redemption on that job. The Hub liability figure is the number to give your CPA if they want to accrue a loyalty liability.
