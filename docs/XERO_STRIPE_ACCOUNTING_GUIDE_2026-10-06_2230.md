<!--
  FILE    : docs/XERO_STRIPE_ACCOUNTING_GUIDE_2026-10-06_2230.md
  PROJECT : Handled (myhumanai) — AI-run home & business services
  CREATED : 2026-10-06_2230 UTC
  PURPOSE : How Handled's books work (Xero = books of record, Stripe = where money moves), how to set up the
            connection, what gets booked where, and the month-end routine.
-->

# Accounting: Xero + Stripe

**Xero is the official set of books. Stripe is where the money moves.** Handled sends every finished day of
Stripe activity to Xero automatically every morning. Business invoices on terms become real Xero invoices, so
your CPA, a factoring partner or a government auditor all see standard books.

Hub page: **Handled Hub → 📒 Accounting (Xero)** (`/hub/accounting`). Admins only.

---

## 1. One-time setup (about 30 minutes)

### Xero
1. **Sign up for Xero** (US). The *Standard* plan is enough to start. Pick **cash basis** for reports, unless
   your CPA says otherwise.
2. **Connect your business checking account** in Xero (Accounting → Bank accounts → Add bank account) so its
   bank feed comes in. Note its **account code**, shown under Accounting → Chart of accounts (for example `090`).
3. **Create the Xero app.** Go to <https://developer.xero.com/app/manage> → **New app** → *Web app*.
   - Company or application URL: your site, for example `https://handledsvc.com`
   - Redirect URI: `https://YOUR-DOMAIN/api/xero/callback`
   - Copy the **Client id** and generate a **Client secret**.

### Vercel
4. Add these environment variables (Production), then redeploy:

   | Variable | Value |
   |---|---|
   | `XERO_CLIENT_ID` | from step 3 |
   | `XERO_CLIENT_SECRET` | from step 3 (secret: Vercel only, never in chat, email or git) |

   Optional: `XERO_REDIRECT_URI` (if it isn't `NEXT_PUBLIC_SITE_URL/api/xero/callback`), `XERO_TENANT_ID`
   (if you authorise more than one organisation), `XERO_TOKEN_KEY` (a separate key that encrypts the saved
   Xero login).

### Supabase
5. In the **existing** project, open Supabase → SQL Editor → paste
   `supabase/setup/ADD_XERO_ACCOUNTING_2026-10-06_2155.sql` → Run. (New projects get it in `HANDLED_SETUP_*.sql`.)

### Stripe
6. No new keys are needed. Handled already uses `STRIPE_SECRET_KEY`. If you use a restricted key, it needs
   **read** access to Balance transactions, Charges, Refunds, Payouts, Transfers and Payment intents.

### Connect
7. Go to Hub → Accounting (Xero) → **Connect Xero**. Sign in, pick your organisation, and allow access.
8. Under **Account mapping**, type your checking account code in **Business checking** → **Save mapping** →
   **Create missing accounts**. This adds the Handled accounts listed below (the codes are only defaults; you
   can point any row at an account you already have) → **Check against Xero**: every row should be green.
9. **Book Stripe activity from**: this defaults to the day you connected. To include earlier days, set an
   earlier date and click **Push everything due now** (it goes back up to 31 days per click).
10. **Preview** yesterday, compare it with Stripe → Balances, then let the daily run take over.

The daily run is `/api/cron/accounting` at 11:20 UTC (about 7:20am in Detroit), from `vercel.json`. It books
yesterday and retries anything that failed in the last 7 days. Anything that keeps failing raises a Hub alert.

---

## 2. What gets booked, and where

Stripe is set up in Xero **as its own bank account** (`1090 Stripe`). Every item is built from Stripe's *balance
transactions*, Stripe's own record of each cent that moved, for one business day (Detroit time).

| Each day | Xero document | Accounts |
|---|---|---|
| Money in | **Receive money** "Stripe YYYY-MM-DD" (contact: Stripe) | 4100 Service revenue · 4110 Handled Plus · 4120 Talent · 4130 Instant pay fees · 2100 Tips owed to pros · 2110 Gift cards · 2120 Sales tax collected · 2130 Materials pass-through |
| Money out | **Spend money** "Stripe YYYY-MM-DD" (contact: Stripe) | 6100 Processing fees · 4190 Customer refunds · 6110 Chargebacks · 6120 Stripe adjustments |
| Each pro paid that day | **Spend money** with the **pro as the contact** | 5100 Pro payouts (job pay, show-up, guarantee, minus deductions) · 5110 Bonuses & stipends · 2100 Tips · 2130 Materials |
| Each Stripe payout | **Bank transfer** Stripe → checking, dated the **arrival day** | matches the deposit on your checking bank feed: reconcile it as a transfer |
| Business invoice on terms | **Sales invoice** (AR), one line per job, same number as Handled's | 4100 Service revenue |
| Payment on that invoice | **Payment** on the invoice into the Stripe account | clears receivables (sales tax still goes to 2120) |

Rules that keep the books right:
- **Sales tax** collected by Stripe Tax goes to *2120 Sales tax collected*, never revenue. Clear it when you
  file. (Michigan doesn't tax most of these services; this matters once you add states that do.)
- **Tips, gift cards and materials** are money held for someone else. They go into a liability account
  and come back out when the pro is paid or the card is used, so they should net close to $0.
- **Instant pay fee:** when a pro cashes out early, the fee (1.75%, $0.50 minimum) is kept from the transfer
  and booked as *4130 Instant pay fees*.
- **The Stripe balance always matches.** Any difference between the entries and Stripe's net for the day
  goes to *6120 Stripe adjustments*, so the Stripe account in Xero always equals Stripe. If this line shows up
  often, tell engineering.
- **Each item is booked exactly once.** The sync log (`xero_sync_log`) and a Xero Idempotency-Key stop
  duplicates. To redo a day, delete its documents in Xero first, then delete that day's rows in
  `xero_sync_log`.
- **A business invoice must reach Xero before its payment.** If it hasn't synced yet, the day waits (shown
  in the log) instead of booking the payment as revenue, which would count it twice.
- **Mark reconciled** (optional): ticks the Stripe-account side as reconciled, because Stripe is the source.
  Leave it off if you'd rather reconcile the Stripe account against a Stripe statement in Xero yourself.

## 3. Month-end routine (15 minutes)
1. Hub → Accounting: no red rows in the log.
2. Xero → **Stripe** account balance = Stripe → Balances (available + pending) at month end.
3. Checking account: reconcile the bank feed. Stripe deposits match the *bank transfers* one to one.
4. *2100 Tips* and *2130 Materials* should be close to $0. If not, look in Hub → Finance for unpaid tips or
   reimbursements.
5. *2110 Gift cards*: when a customer pays with a gift card, record a journal for redemptions (debit 2110,
   credit 4100) from Hub → Growth. Gift card redemptions aren't Stripe money, so they aren't synced yet.
6. Send the month to your CPA: Profit & Loss, Balance Sheet, Aged Receivables.

## 4. What's not in Xero sync
- **Payroll for W-2 staff:** use **Gusto** (connects to Xero). Pros are 1099 contractors paid through Stripe Connect.
- **1099s for pros:** Handled's year-end 1099 worksheet (Hub → Pro Network) has every pro's total, and Xero's
  spend-by-contact report shows the same. Ask your CPA whether Stripe Connect files 1099s for you
  (Stripe Connect → Tax forms) or whether you file 1099-NEC yourself.
- **Customer prepayments** are booked as revenue when paid (cash basis). If you move to accrual, map
  *Service revenue* to a "Customer deposits" liability and recognise revenue at month end from Hub → Finance.

## 5. Paying pros: the "DoorDash card" question
DoorDash's card is **DasherDirect**, a debit card and bank account run by **Payfare** with a partner bank.
Lyft, Uber and Instacart use the same kind of program. Three ways Handled can get there:

| Option | What the pro gets | Effort |
|---|---|---|
| **What Handled has today:** Stripe Connect instant payouts | Money on their **own** debit card in minutes, 1.75% fee | Live now |
| **Branded pro card from a payout partner** (Payfare, Branch) | A Handled-branded debit card + app, paid instantly after every job, often free to the pro | Partnership + bank compliance review, usually 2–4 months. Needs real volume |
| **Stripe Issuing for Connect platforms** | Handled-issued cards on each pro's Stripe account (best for paying materials at the store) | Stripe application + approval. Card programs have their own compliance rules |

Recommendation: keep Stripe instant payouts now, and add a **Stripe Issuing card for materials purchases**
once approved. Talk to Payfare or Branch about a branded pay card once you have about 100+ active pros.
