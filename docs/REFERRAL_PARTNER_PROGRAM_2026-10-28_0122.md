<!--
  FILE    : docs/REFERRAL_PARTNER_PROGRAM_2026-10-28_0122.md
  PROJECT : Handled (HandledServices) — AI-run home & business services
  CREATED : 2026-10-28_0122 UTC
  PURPOSE : How the Referral Partner Program works (partner-v2): what partners earn, who pays it, the standard
            referral ticket, how to turn it on and how to run it. Replaces REFERRAL_PARTNER_PROGRAM_2026-10-07_0150.md.
-->

# Referral Partner Program (partner-v2)

**Send us a job, get paid on it.** Anyone (realtors, property managers, contractors, business owners, neighbors)
can sign up at **/partners** and earn on the customers they send.

## What partners earn: the same rate on every service

Partners earn a fixed share of the **job price** (what the customer pays, minus refunds). Under the old rule they
got 10% of *our fee*, and our fee ranges from 15% to 40% by service, so the same $300 job paid a partner anywhere from $4.50
to $12. Now every service pays the same rate:

| Tier | Partner earns | Paid by the pro | Paid by Handled | $300 job |
|---|---|---|---|---|
| **One-time job**: the referred customer's first job | **25%** | 12.5% | 12.5% | $75.00 |
| **Repeat or recurring**: every later job or recurring visit, for 12 months | **10%** | 5% | 5% | $30.00 |
| **Business / property account**: every job on a referred account, for 12 months | **15%** | 7.5% | 7.5% | $45.00 |

- **Which tier a job gets** is set when it's booked (`partnerTier()`): a job on a business account always
  pays the account rate. Otherwise the customer's first job pays 25% if it's one-time, and everything after it, or any
  recurring visit, pays 10%.
- **The pro's half** is a term on the work order, so the pro sees it before accepting ("a referral fee of 12.5% of
  the job price ($37.50) comes off this payout"). It comes off that job's payout line when the job is completed,
  and it never exceeds the payout. It's in the pro agreement (**v10**, section 10), which pros re-sign before their
  next offer. A pro still on an older agreement pays nothing; Handled's half is all the partner gets on that job.
- **Handled's half** never exceeds what we keep on the job after the card fee, so a referred job can't lose
  us money. On a thin-fee job the partner can get less than the full rate, which is why the terms say "up to".
- **Refunds** reduce the commission before it's paid. When the pro's half goes down, the difference is handed back to
  the pro on their next payout (payout kind `partner_fee`). Voiding a commission in the Hub hands the pro's half
  back too.
- **Jobs booked before 2026-10-28** keep the old rule (10% of our fee, paid by Handled alone).

| Other rule | Setting |
|---|---|
| How long | **12 months** from the referral. |
| When paid | **Mondays**, through Stripe, once the job is **30 days** past completion (the make-it-right window). |
| Minimum | Balances under **$25** roll over to the next week. |
| Link window | A partner link counts for **90 days** after the click. |
| Who counts | **New customers only.** One partner per customer (the first one). No self-referrals. |

The rules live in `packages/core/src/partners.ts` (`PARTNER_TIERS`, `PARTNER_PROGRAM`, `partnerSplit()`) and are
covered by tests. Every page, email, the Hub, the partner terms and the pro agreement read their numbers from there,
so changing a rate there changes it everywhere. Bump `termsVersion` and the pro `AGREEMENT_VERSION` when you do.

## The standard referral ticket

Every referral a partner sends from **/partner** uses the same form and gets a ticket number (`RT-XXXXXX`):

1. **Customer:** full name, company (if a business), email, phone (required unless they prefer email), best way
   to reach them (call / text / email), best time.
2. **Where:** street address (optional), city, ZIP (required).
3. **The job:** service (or "not sure"), type of job (one-time / recurring / business or property account), when
   they need it (ASAP / within a week / within a month / a specific date / flexible), what needs doing. The form
   shows the partner what they'll earn for the job type they pick.
4. **You and them:** how the partner knows them, an optional note that goes in our email from the partner, and a
   **required consent box**: the customer agreed that the partner can share their details and that Handled may contact them.

When a ticket is submitted:
- the customer gets a booking link from the partner,
- the partner gets an email copy with the ticket number and what they'll earn,
- ops gets an email copy and the ticket appears in **Hub → Partners → Referral tickets to work**.

**Ticket status:** Submitted → We reached out (staff) → Booked → Job done → Paid, or Closed (staff, with a reason).
Booked, Job done and Paid update on their own from the customer's jobs and commissions. The partner sees every ticket
and its status on /partner.

## Turning it on
1. Supabase → SQL Editor → run `supabase/setup/ADD_PARTNER_TICKETS_2026-10-28_0122.sql` once (safe to run twice).
   Needs the original partner tables (`ADD_REFERRAL_PARTNERS_2026-10-07_0100.sql`, already in the full setup).
   Hub → Setup shows it as done once it has run.
2. Pros are asked to re-sign the Independent Contractor Agreement (v10) before their next offer, as with every
   agreement update.
3. Have your attorney review the new pro agreement clause (section 10, "Referral partner fee") and the partner terms
   (`docs/CONTRACTS_2026-10-28_0133.md`).
4. Email existing partners about the new rates. The v1 terms promised 30 days' notice of changes, and every tier pays at least as much
   as before.

## Running it (Hub → Partners)
- **Referral tickets to work:** reach out to the customer as the ticket says, then mark **We reached out**, or
  **Close** it with a reason (not interested, out of area…).
- Every partner, their customers, what's owed and what's paid.
- **Commission queue:** each commission's rate and how much the pro and Handled each pay.
- **Pause** a partner who breaks the rules. **Credit a customer by hand** when someone booked without the link.
  **Void** a commission before it's paid (the pro's half is handed back).

## Accounting and 1099s
Partner payouts are booked to *6130 Referral commissions*, one spend per partner. The pro's half shows on the pro's
statement as a lower job payout ("Job pay $X − $Y referral partner fee"). Partners paid **$600 or more** in a year
need a 1099-NEC; Stripe Connect collects their tax details during payout setup.

## Who to recruit first (Metro Detroit)
| Partner | Why they refer | Best tier |
|---|---|---|
| Realtors | Every listing needs a move-out or deep clean, junk removal, small repairs | 25% one-time |
| Property managers / HOAs | Unit turnovers, grounds, snow | 15% account |
| Contractors & remodelers | Post-construction clean, haul-away | 25% one-time |
| Moving companies | Move-out / move-in cleans | 25% one-time |
| Neighbors, customers | Friends on recurring cleaning or lawn care | 10% repeat |
| Office managers / coworking | Janitorial, events | 15% account |
