<!--
  FILE    : docs/REFERRAL_PARTNER_PROGRAM_2026-10-07_0150.md
  PROJECT : Handled (HandledServices) — AI-run home & business services
  CREATED : 2026-10-07_0150 UTC
  PURPOSE : How the Referral Partner Program works, how to turn it on, and how to recruit partners.
-->

# Referral Partner Program

**Send us a job, get paid on it.** Anyone (realtors, property managers, contractors, business owners, neighbors)
can sign up at **/partners** and earn on the customers they send.

| Rule | Setting |
|---|---|
| Commission | **10% of Handled's take** (job price − pro payout − refunds). It comes out of our share and never the pro's pay, so a referred job can't lose money. |
| How long | **12 months** from the customer's first referral. Repeat and recurring visits count. |
| When paid | **Mondays**, through Stripe, once the job is **30 days** past completion (the make-it-right window). |
| Minimum | Balances under **$25** roll over to the next week. |
| Link window | A partner link counts for **90 days** after the click. |
| Who counts | **New customers only.** One partner per customer (the first one). No self-referrals. |

The rules live in `packages/core/src/partners.ts` (`PARTNER_PROGRAM`) and are covered by tests. Change the
numbers there, then update the terms version.

## How a partner earns
1. **Signs up** at `/partners`. They get a code (e.g. `JANE7K2Q`), a link (`/home?partner=JANE7K2Q`), a short link
   for cards and texts (`/r/JANE7K2Q`), and a welcome email with a one-tap sign-in to **/partner**.
2. **Refers a customer** in one of two ways:
   - **Their link:** a new customer who books within 90 days of clicking it becomes theirs.
   - **"Send us a customer"** on /partner: the partner enters the customer's name and email, and we email the
     customer a booking link from the partner. The customer is theirs for 12 months, even if they book later or in the app.
3. **The job is completed.** A commission is recorded (10% of our take), payable 30 days later.
4. **Monday payout.** Commissions are re-checked against refunds (a refund reduces or cancels the commission),
   then sent to the partner's bank via Stripe Connect. The partner sets up payouts once on /partner, and Stripe
   collects their tax details for the 1099.

## Turning it on
1. Supabase → SQL Editor → run `supabase/setup/ADD_REFERRAL_PARTNERS_2026-10-07_0100.sql` once.
2. Stripe Connect is already used for pro payouts. Partners use the same setup (Express accounts), so there's nothing new to configure.
3. If Xero is connected: Hub → Accounting → **Create missing accounts** adds *6130 Referral commissions*.
   Each partner's weekly payout is booked as a spend to that partner (1099 detail by partner).
4. Have your attorney review the terms on /partners before you promote the program widely.

## Running it (Hub → 💸 Referral partners)
- See every partner, their customers, what's owed and what's paid.
- **Pause** a partner who breaks the rules. They stop earning on new jobs.
- **Credit a customer by hand** when a partner sent someone who booked without the link. This pays on future
  jobs only.
- **Void** a commission before it's paid (for example, fraud or a dispute).

## 1099s
Partners paid **$600 or more** in a calendar year need a 1099-NEC. Stripe Connect collects their tax details
during payout setup, and Xero has each partner's total under spend by contact. Ask your CPA whether to file
through Stripe Connect (Tax forms) or yourself.

## Who to recruit first (Metro Detroit)
| Partner | Why they refer | Pitch |
|---|---|---|
| Realtors | Every listing needs a move-out or deep clean, junk removal, small repairs | "Your sellers get a 60-second price and photo proof; you earn on every job for a year." |
| Property managers / HOAs | Unit turnovers, grounds, snow | Recurring work = recurring commission |
| Contractors & remodelers | Post-construction clean, haul-away | Jobs they don't do themselves |
| Moving companies | Move-out / move-in cleans | Same customers, same week |
| Office managers / coworking | Janitorial, events | Commercial jobs pay the biggest commissions |
