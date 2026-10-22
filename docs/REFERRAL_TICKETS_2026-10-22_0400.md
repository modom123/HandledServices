<!--
  FILE    : docs/REFERRAL_TICKETS_2026-10-22_0400.md
  PROJECT : Handled (HandledServices) — AI-run home & business services
  CREATED : 2026-10-22_0400 UTC
  PURPOSE : How the referral program pays pros, clients and partners: refer a person, or send a job on a referral ticket.
            What happens to a ticket from submission to payout, who gets paid what, and how to switch it on.
  UPDATED : 2026-10-22_0600 UTC — the Standard Referral Ticket (RT-1), photos, autofill, Handled Hub views, IEBC worker actions.
  UPDATED : 2026-10-22_0700 UTC — ticket invites: send the ticket to someone on the phone; filling it out signs them up.
  UPDATED : 2026-10-22_0800 UTC — pros and partners send ticket invites too, from their partner page.
-->

# Referral program — referral tickets

Pros, clients and anyone else in the partner program can get paid for sending Handled work. There are two ways to refer:

| You refer… | You earn | For how long |
|---|---|---|
| **A person** (your link, or "Send us a person") | **10%** of Handled's fee on every job they book | 12 months |
| **A one-time job** (referral ticket) | **20%** of Handled's fee on that job | That job |
| **A recurring job** (referral ticket, weekly / every 2 weeks / monthly / quarterly) | **15%** of Handled's fee on every visit | 12 months from booking |

**Handled's fee** ("job profit") = what the customer paid − what the pro is paid − refunds. The commission comes out of
**Who pays the bonus (from jobs accepted 2026‑11‑22):** half from Handled's take, half from the pro who does the job.
The bonus is worked out on the pro's full pay, the pro's half is rounded down to the cent, and it shows on the offer and
work order before they accept. It's a separate line on the pro's payout statement, and it goes down with refunds. Before
that date, or when no pro is on the job, Handled pays it all. See **Shared referral bonus** below. One job pays one commission.

Rates live in one place: `PARTNER_PROGRAM` in `packages/core/src/partners.ts`.

## Where people find it

- **Pros:** Pro portal → Money → 🤝 **Refer & earn** (`/partner`). One tap to join. Commissions go to the same Stripe
  account as their job payouts.
- **Clients:** My account → **Earn cash for referrals** card (`/partner`). One tap to join, then Stripe payout setup once.
- **Anyone else:** `/partners` sign-up form, then the partner page.

## The Standard Referral Ticket (RT-1)

Every referral uses the same ticket, whether it comes from a pro, a client, a partner, a phone call or an IEBC worker. It has the
same sections every time, so each job arrives with what a pro needs. The single definition lives in
`packages/core/src/referral-ticket.ts`. It drives the online form, the server check, the AI filing, the Hub review, the
booking notes and the **printable blank ticket at `/partners/referral-ticket`**.

| Section | Required | Recommended |
|---|---|---|
| 1. You and the customer | How you know them | — |
| 2. Customer | Name, email, mobile (10 digits), best way to reach them | Best time, company, "can approve and pay" |
| 3. Location | Street, city, state, ZIP, type of property | Occupied or empty, getting in, parking, pets |
| 4. The job | Description (30+ characters), how often, when, **the service's required sizes** (e.g. lawn square feet) | Service (or the AI picks), the service's other detail questions, wished date, budget |
| 5. Photos | **The service's required photos** (e.g. 2 for power washing) | Photos where the service recommends them |
| 6. Confirm | The customer asked for it, and knows Handled will contact them | Pro: "I'd like to do it myself" |

The form shows a live **completeness meter** with a "still needed" list, and won't submit until every required item is
there. The server runs the same check (`ticketCheck`). Each ticket stores its standard version and a 0–100 score.
The Hub shows the score so weak tickets stand out. The referrer's own size answers are kept over the AI's reading.

**Autofill:** a ZIP fills in city and state. A customer the referrer has sent before is filled in from the referrer's
*own* earlier ticket (never anyone else's data).

## Sending a ticket to someone on the phone (ticket invites)

When we're on a call with someone who has a job for us, or could send us work (a contractor, a realtor, a customer,
a business lead), we send them their own referral ticket:

1. **Send.** Use **Hub → Referrals & tickets → 📞 Send a referral ticket**, or the **🎫 Send them a referral ticket**
   section on any **Call desk** card (already filled in from the lead). An IEBC worker can also send one with
   `sales.send_ticket_invite`, which always waits for a person to approve it. Enter their name, email and/or mobile, what
   they are, and the job they mentioned. Send by **email**, by **text** (only if they said OK to a text on the call), or both.
2. **They open their link** (`/ticket/<token>`, valid 30 days, no sign-in needed). The Standard Referral Ticket opens
   with an **About you** section already filled in from the call, plus the job they mentioned as the description.
3. **They send the job, or just join.** Submitting the ticket, or tapping **"No job right now — just sign me up"**:
   - signs them up as a **referral partner**. They accept the partner terms, and the welcome email has their partner
     link and a one-tap sign-in that creates their Handled account. They're now in the network.
   - sends the ticket through the normal flow (AI filing → customer's booking link → dispatch → payouts).
   - If the ticket needs a fix, they're still signed up, and can fix it and resend from the same link.
4. **Pros and partners can send invites too.** On their partner page (Pro portal → Refer & earn, client account →
   Earn cash for referrals), under **📞 Send a referral ticket to someone you talked with**. The message says who asked us
   to send it. The sender is emailed when the person joins, and sees everyone they invited under *People you've invited*.
   The person joins as their own referral partner and earns on the jobs *they* send. Limits: active partners only,
   15 invites a day, not to themselves or to someone already in the network, and a text only if the person said OK.
5. **Become a pro too.** The thank-you screen offers **Apply as a pro**, which opens the pro application filled in with
   their name, email, mobile and business.
6. **We hear back.** The person who sent the invite gets an email, and an ops alert is raised. The Hub's invites list shows
   *not opened → opened → joined / joined + sent a job*. The dashboard strip counts invites out and people joined.
   Unused invites expire after 30 days.

## The referral ticket, start to finish

1. **Submit.** On `/partner` (Pro portal → Refer & earn; client account → Earn cash for referrals; app → same) the
   referrer fills out the Standard Referral Ticket above, including up to 8 photos. A pro can also tick **"I'd like to
   do this job myself."**
2. **AI files it** (`apps/web/lib/ai/referral-ticket.ts`, agent `referral_ticket`). Claude looks at the photos too, picks the catalog service,
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

## Shared referral bonus — half Handled, half the pro

`REFERRAL_COST_SPLIT` in `packages/core/src/partners.ts`, with tests in `partners.test.ts`, checks
customer = pro + referrer + Handled to the cent over 3,000 random jobs.

- **Bonus** = rate × Handled's take, where take = price − the pro's **full** pay − refunds. The rate is 10% for a person,
  15% for a recurring ticket and 20% for a one-time ticket. The pro's half never feeds back into the take.
- **Pro's half** = half the bonus, rounded down to the cent. **Handled's half** = the rest, so Handled covers any odd cent.
- **When:** jobs whose offer the pro accepts on/after **2026‑11‑22** (30 days' notice under the contractor agreement), by a pro
  on agreement **v10+**. Otherwise, or when no pro is on the job, Handled pays the whole bonus.
- **Shown before accepting:** the work order (v4) on the offer page, in the app and in the offer emails says, for example,
  "the $24 referral bonus … $12 comes out of this payout (you receive $268)".
- **Paid:** at completion the pro's half becomes a line on their statement ("Your half of the referral bonus — JOB‑REF",
  payout kind `referral_share`), netted in the Monday payout like a clawback. If a refund lowers the bonus or staff void it,
  `syncProShare` lowers or removes the line, or returns the difference if it was already netted.
- **Switch on:** `supabase/setup/ADD_SHARED_REFERRAL_BONUS_2026-10-22_0900.sql`. Agreement v10 asks every pro to
  re-sign before their next offer.

### Worked examples (real pricing engine)

| Job | Customer pays | Pro's full pay | Handled take | Bonus | Pro pays | Handled pays | Pro nets | Referrer | Handled nets |
|---|---|---|---|---|---|---|---|---|---|
| Lawn care every 2 weeks, ticket (15%) — per visit | $150.00 | $112.00 | $38.00 | $5.70 | $2.85 | $2.85 | $109.15 | $5.70 | $35.15 |
| — over 12 months (26 visits) | $3,900.00 | $2,912.00 | $988.00 | $148.20 | $74.10 | $74.10 | $2,837.90 | $148.20 | $913.90 |
| $10,000 roof (one time), ticket (20%) | $10,000.00 | $6,297.00 | $3,703.00 | $740.60 | $370.30 | $370.30 | $5,926.70 | $740.60 | $3,332.70 |

## In the Handled Hub (MasterMind)

- **Dashboard:** a 🤝 Referrals strip showing tickets needing review, waiting on the customer, booked this month, owed and paid.
- **Referrals & tickets** (`/hub/partners`): the ticket queue with score, standard fields, AI summary, missing info and
  photos. Actions: approve & send, re-send, cancel. Also partners, hand credits and the commission queue.
- **Job control panel:** who referred the job, the rate, the commission and its status, and the money split.
- **Pro record:** tickets the pro sent, booked jobs, and their referral earnings. **Customer record:** who referred them and their tickets.
- **Finance:** referral commissions earned, owed and paid, and take after referrals.
- **AI morning brief and ops assistant:** both include the ticket queue.
- **Daily sweep:** expires tickets that weren't booked within 60 days and tells the referrer.

## IEBC AI workers (Workforce API)

IEBC's AI workers see these in their action list automatically, by department:

| Action | Scope | Risk |
|---|---|---|
| `read.referral_tickets` | read | — |
| `sales.send_referral_ticket` (approve & send the customer's link) | sales | low |
| `sales.cancel_referral_ticket`, `sales.note_referral_ticket` | sales | low |
| `read.ticket_invites` | read | — |
| `sales.send_ticket_invite` (send the ticket to someone after a call) | sales | **high: always approved by a person** |
| `finance.referral_commissions` | finance | — |
| `finance.void_referral_commission` | finance | **high: always approved by a person** |

New tickets that need review also raise an ops alert, which workers already read (`read.alerts`).

## Rules and guards

- The customer must have asked for it (required checkbox). No ticket for yourself.
- A customer already referred by **another** partner (inside their 12 months) can't be sent on a ticket. If a person
  referral and a ticket race, the earlier one wins.
- Existing Handled customers *can* be sent a new job on a ticket, since that's new work.
- One open ticket per customer + service. Tickets expire after 60 days if not booked.
- Suspended partners aren't paid. Balances under $25 roll to the next week.

## Switch it on

1. Supabase → SQL Editor → paste **`supabase/setup/ADD_REFERRAL_TICKETS_2026-10-22_0400.sql`** → Run (safe to run twice;
   **run it again if you ran an earlier copy** — it adds photos and the standard-ticket fields). Hub → Setup checks it.
   Same as `supabase/migrations/20261022040000_referral_tickets.sql`.
2. Then paste **`supabase/setup/ADD_TICKET_INVITES_2026-10-22_0700.sql`** → Run (ticket invites for phone calls).
   Texts need Twilio set up (already used for job texts); without it, invites go by email.
3. Deploy. Without `ANTHROPIC_API_KEY`, tickets still work: the referrer's chosen service is used, and unclear tickets go
   to staff review.

Until the SQL is run, person referrals keep working exactly as before. The ticket form answers "Referral tickets aren't
switched on yet", and Hub → Partners shows the file to run.

## Files

| What | Where |
|---|---|
| Rates, money split, terms (v2) | `packages/core/src/partners.ts` (+ `partners.test.ts`) |
| Tickets, join, attribution, commissions, payouts | `apps/web/lib/partners.ts` |
| The Standard Referral Ticket | `packages/core/src/referral-ticket.ts`, printable at `/partners/referral-ticket` |
| AI filing | `apps/web/lib/ai/referral-ticket.ts` |
| IEBC worker actions | `apps/web/lib/iebc/actions.ts` |
| Ticket invites (phone calls) | `apps/web/lib/ticket-invites.ts`, `/ticket/[token]`, `/api/ticket-invite`, `components/PartnerUI.tsx` (`SendTicketInvite`), `components/CallDesk.tsx` |
| ZIP autofill | `apps/web/app/api/zip/route.ts`, `lib/geo.ts` (`zipPlace`) |
| Booking prefill & credit | `apps/web/app/(site)/book/page.tsx`, `components/BookingWizard.tsx`, `lib/jobs.ts` |
| Partner page (ticket form, tickets, money split) | `apps/web/app/(site)/partner/page.tsx`, `components/PartnerUI.tsx` |
| Hub queue (approve, re-send, cancel) | `apps/web/app/hub/partners/page.tsx`, `app/api/hub/partners/route.ts` |
| Database | `supabase/migrations/20261022040000_referral_tickets.sql` |
