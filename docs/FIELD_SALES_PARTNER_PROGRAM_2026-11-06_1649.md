<!--
  FILE    : docs/FIELD_SALES_PARTNER_PROGRAM_2026-11-06_1649.md
  PROJECT : Handled (HandledServices) — AI-run home & business services
  CREATED : 2026-11-06_1649 UTC
  PURPOSE : Field Sales through the Partner Program: the two ways to earn (direct sales and referrals), the close-ready
            ticket, paying with a rep's code, the 10% → 45% commission ladder (45% at $1M profit generated), how to
            turn it on, and the legal checks before recruiting on Indeed.
-->

# Field Sales: the Partner Program sales force

Partners earn on every completed job they bring to Handled. There are **two ways to earn**, and both pay the same
ladder rate and count toward the partner's next raise.

| | Way 1: Direct sales | Way 2: Referrals |
|---|---|---|
| Who sells | The partner sells the service and writes a **ticket** | Handled sells; the partner sends the customer |
| How | Partner page → **Write a ticket** | Link `/r/CODE`, the code typed at checkout, or **Send us a customer** |
| The customer pays | On the rep's phone right then (**Pay now on this phone**), or from the text/email we send | When they book |
| Shown as | `Direct sale` (that job and the customer's repeat visits) | `Referral` |

Every customer belongs to one partner (the first one) for 12 months, repeat and recurring visits included. Partners
never take payment. Customers always pay Handled through Stripe checkout.

## Way 1: the close-ready ticket

A rep can sell **any service in the catalog**. The ticket can't be sent until it holds everything needed to close,
so the customer pays without being asked anything again (`ticketCloseCheck` in `packages/core/src/partners.ts`):

| Required | Why |
|---|---|
| The service and its required measurements (sq ft, linear ft, rooms…) | That's what sets the price |
| **3–4 photos** for on-site work (more if that service's photo rule needs it). **None** for remote services (websites, AI, formation, consulting) | Our AI checks the scope before payment |
| Customer name, email and **mobile** | We text and email the pay link |
| Full service address (on-site work) | Pricing area, dispatch, the pro |
| When they need it (ASAP / this week / 2 weeks / month / flexible) | Scheduling |
| "I spoke with the person who decides and pays" | No tickets for people who can't say yes |
| "They asked Handled to text and email them. I didn't take payment." | Consent for texts (TCPA) and no cash handling |

Optional: how often (recurring plans are sales too), preferred day and arrival window, home or business (plus
company), budget, gate code / pets / parking (only the assigned pro sees it), and **what's holding them back**. That
last one goes to ops for follow-up.

While the rep fills it in, the form shows the **live upfront price** from the same engine as booking. Photos are sent
to the AI, which suggests the service and sizes. On send:

1. The customer is claimed for the rep (new customers only, not already another partner's).
2. The customer gets a text and email: *"your [service] is ready, $X, review & pay"* → `/book?ticket=…`.
3. The rep sees **Pay now on this phone** and **Copy pay link**, so they can close on the spot.
4. The booking opens with everything filled in: service, sizes, frequency, photos, notes, contact, address,
   timing, budget and access notes. The customer checks it, accepts the Service Agreement and pays. The AI photo check
   can still adjust the price within the normal limits, and some jobs need a free site visit.
5. **Paid → job board.** The job dispatches like any booking. Nothing goes to pros before it's paid.
6. **Completed → commission** at the rep's rate, payable Monday after the 30-day guarantee.

Unbooked tickets expire after 30 days (daily sweep). The customer stays the rep's for 12 months.

### Paying with the rep's code
Any new customer can type a partner's code (e.g. `JANE7K2Q`) in the booking's code box. The booking shows *"✓ Partner
code JANE7K2Q — Jane gets credit"* (no discount), and the job is credited to that partner. A typed code beats an
earlier link click.

## The commission ladder: 10% → 45% of profit

**Profit** = job price − pro payout − refunds (Handled's take). It comes out of our share, never the pro's pay.

- Every level is **+1 point**, from 10% (level 0) to 45% (level 35).
- A level is reached by the partner's **lifetime profit generated** for Handled on this curve:
  **threshold(n) = $1,000,000 × (n ÷ 35)²**, rounded. Raises come quickly at the start, and the top rate is at $1M.
- **Fast track:** every **10 completed jobs** is also +1 point, **up to 20%**, so steady sellers move up early. Only
  profit takes anyone past 20%. The higher of the two counts.
- The rate is **locked when each job is completed** (from what they'd generated before that job) and **never goes down**.

| Rate | Lifetime profit generated | Rate | Lifetime profit generated |
|---|---|---|---|
| 10% | $0 (day one) | 11% | $800 |
| 12% | $3,300 | 13% | $7,300 |
| 14% | $13,000 | 15% | $20,500 |
| 16% | $29,500 | 17% | $40,000 |
| 18% | $52,000 | 19% | $66,000 |
| 20% | $81,500 | 21% | $99,000 |
| 22% | $118,000 | 23% | $138,000 |
| 24% | $160,000 | 25% | $184,000 |
| 26% | $209,000 | 27% | $236,000 |
| 28% | $264,000 | 29% | $295,000 |
| 30% | $327,000 | 31% | $360,000 |
| 32% | $395,000 | 33% | $432,000 |
| 34% | $470,000 | 35% | $510,000 |
| 36% | $552,000 | 37% | $595,000 |
| 38% | $640,000 | 39% | $687,000 |
| 40% | $735,000 | 41% | $784,000 |
| 42% | $836,000 | 43% | $889,000 |
| 44% | $944,000 | **45%** | **$1,000,000** |

**What it means per job.** For a $400 job where the pro is paid $300, profit is $100:
10% = $10 · 20% = $20 · 30% = $30 · 45% = $45. At the top rate Handled still keeps 55% of the profit.

**Reaching 45%.** With our take at about 25% of the price, $1M of profit is roughly **$4M in completed job sales**.

To change the numbers, edit `PARTNER_LADDER` in `packages/core/src/partners.ts` (tests in `pricing.test.ts`) and bump
`termsVersion`. Rates already locked on completed jobs don't change.

## Where it shows

| Page | What's there |
|---|---|
| `/partners` (public) | Two ways to earn, how direct sales work, ladder milestones, sign-up. `?kind=sales_rep` pre-selects *Field Sales partner* |
| `/partner` (the partner) | Level, rate, profit generated and progress to the next raise; full ladder; **Way 1** ticket form + tickets (price shown, pay link, job status); **Way 2** link, code, send a customer, customers; payouts; commissions with rate and how earned |
| `/book?ticket=…` (the customer) | Everything pre-filled; "Jane set this up with you… you pay Handled directly" |
| Hub → Referral partners | Each partner's rate, profit generated, jobs and tickets; the Field Sales ticket feed; commission queue with rate and Direct sale / Referral |

## Turning it on
1. Supabase → SQL Editor → run `supabase/setup/ADD_FIELD_SALES_2026-11-06_1638.sql` once (safe to run twice).
2. Twilio set up (Hub → Go-live setup) so tickets text the pay link. Without it, the email still goes out.
3. Deploy. The daily sweep expires old tickets, and Monday payouts already include ticket commissions.
4. Have your attorney review the updated partner terms (`partner-v2`) and the Indeed post before you recruit.

## Before you recruit on Indeed: talk to your attorney and CPA
- **Contractor vs. employee.** Partners are independent (1099), commission-only, set their own hours, and have no
  quota. Calling it a "part-time / full-time job" can make it look like employment. The Indeed post is written as
  *"work a few hours a week or make it your main income"*. Under federal law (FLSA), commission-only **outside
  salespeople** are generally exempt from minimum wage. Michigan and Washington have their own tests, so get a ruling
  before you lean on that.
- **Commission-only must be clear** in the post, with no guaranteed pay.
- **Texts:** only customers who asked to be contacted (the ticket requires that checkbox). Every text includes STOP.
- **Licensing:** reps sell Handled's services and never quote outside the app or promise work we didn't price.
- **1099s:** Stripe Connect collects tax details. Anyone paid $600+ in a year gets a 1099-NEC.
