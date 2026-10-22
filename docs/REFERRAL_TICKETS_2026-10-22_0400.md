<!--
  FILE    : docs/REFERRAL_TICKETS_2026-10-22_0400.md
  PROJECT : Handled (HandledServices) — AI-run home & business services
  CREATED : 2026-10-22_0400 UTC
  PURPOSE : How the referral program pays pros, clients and partners: refer a person, or send a job on a referral ticket.
            What happens to a ticket from submission to payout, who gets paid what, and how to switch it on.
-->

# Referral program — referral tickets

Pros, clients and anyone else in the partner program can get paid for sending Handled work. There are two ways to refer:

| You refer… | You earn | For how long |
|---|---|---|
| **A person** (your link, or "Send us a person") | **10%** of Handled's fee on every job they book | 12 months |
| **A one-time job** (referral ticket) | **20%** of Handled's fee on that job | That job |
| **A recurring job** (referral ticket, weekly / every 2 weeks / monthly / quarterly) | **15%** of Handled's fee on every visit | 12 months from booking |

**Handled's fee** ("job profit") = what the customer paid − what the pro is paid − refunds. The commission comes out of
Handled's share, **never the pro's pay**. One job pays one commission.

Rates live in one place: `PARTNER_PROGRAM` in `packages/core/src/partners.ts`.

## Where people find it

- **Pros:** Pro portal → Money → 🤝 **Refer & earn** (`/partner`). One tap to join. Commissions go to the same Stripe
  account as their job payouts.
- **Clients:** My account → **Earn cash for referrals** card (`/partner`). One tap to join, then Stripe payout setup once.
- **Anyone else:** `/partners` sign-up form, then the partner page.

## The referral ticket, start to finish

1. **Submit.** On `/partner` the referrer fills out the ticket: the customer (name, email, phone, company), where (address,
   ZIP), the job (service or "let our AI pick", how often, when, budget, description), how to get in, and a box
   confirming *the customer asked them to send it*. A pro can also tick **"I'd like to do this job myself."**
2. **AI files it** (`apps/web/lib/ai/referral-ticket.ts`, agent `referral_ticket`). Claude picks the catalog service,
   frequency, and the pricing answers that service asks (rooms, sq ft, size), writes a short summary, and lists what's
   missing. Every value is checked against the catalog, and nothing is invented. The ticket is saved in
   `referral_tickets` under the **referrer** (`partner_id`) and the **customer's Handled account** if they have one
   (`customer_id`, matched by email).
   - Clear ticket → status **open**, and the customer is emailed a personal link (`/book?ticket=…`).
   - Unclear (no service, low confidence, no ZIP) → **needs review**. Staff pick the service in Hub → Partners →
     Referral tickets and click **Approve & send link**.
3. **Customer books.** The link opens the booking page with everything filled in: contact, address, service, sizes, how
   often, when, and notes. The customer checks it, sees the upfront price, accepts the service agreement and pays.
   Paying upfront is still the rule, so nothing goes to a pro until it's paid.
4. **Credit.** At booking the job is linked to the ticket (`jobs.referral_ticket_id`). This works from the link, or from
   the same email and service within 60 days. One-time vs recurring is set by what the customer actually booked.
5. **Broadcast & assign.** The paid job goes through normal dispatch: ranked offers to eligible pros, and the first to
   accept is assigned. If the referring pro asked to do it, they get the first look, but only if they're eligible
   (approved, insured, licensed, in range, free). Otherwise it goes straight to everyone else.
6. **Done → everyone is paid.**
   - **Pro:** their normal payout (unchanged).
   - **Referrer:** a commission row at 20% / 15% (or 10% for a person referral), payable after the 30-day make-it-right
     window, in the Monday Stripe payout. Refunds reduce or cancel it first.
   - **Handled:** keeps the rest.
   The referrer gets an email with the full split, e.g. *Customer paid $400 · pro $280 · you $24 · Handled $96*.
   Recurring visits keep paying every visit until `pays_until` (12 months).

The referrer is emailed at every step (booked, pro assigned, done and earned), and each ticket keeps a timeline on the
partner page and in the Hub.

## Rules and guards

- The customer must have asked for it (required checkbox). No ticket for yourself.
- A customer already referred by **another** partner (inside their 12 months) can't be sent on a ticket. If a person
  referral and a ticket race, the earlier one wins.
- Existing Handled customers *can* be sent a new job on a ticket, since that's new work.
- One open ticket per customer + service. Tickets expire after 60 days if not booked.
- Suspended partners aren't paid. Balances under $25 roll to the next week.

## Switch it on

1. Supabase → SQL Editor → paste **`supabase/setup/ADD_REFERRAL_TICKETS_2026-10-22_0400.sql`** → Run (safe to run twice).
   Same as `supabase/migrations/20261022040000_referral_tickets.sql`.
2. Deploy. Without `ANTHROPIC_API_KEY`, tickets still work: the referrer's chosen service is used, and unclear tickets go
   to staff review.

Until the SQL is run, person referrals keep working exactly as before. The ticket form answers "Referral tickets aren't
switched on yet", and Hub → Partners shows the file to run.

## Files

| What | Where |
|---|---|
| Rates, money split, terms (v2) | `packages/core/src/partners.ts` (+ `partners.test.ts`) |
| Tickets, join, attribution, commissions, payouts | `apps/web/lib/partners.ts` |
| AI filing | `apps/web/lib/ai/referral-ticket.ts` |
| Booking prefill & credit | `apps/web/app/(site)/book/page.tsx`, `components/BookingWizard.tsx`, `lib/jobs.ts` |
| Partner page (ticket form, tickets, money split) | `apps/web/app/(site)/partner/page.tsx`, `components/PartnerUI.tsx` |
| Hub queue (approve, re-send, cancel) | `apps/web/app/hub/partners/page.tsx`, `app/api/hub/partners/route.ts` |
| Database | `supabase/migrations/20261022040000_referral_tickets.sql` |
