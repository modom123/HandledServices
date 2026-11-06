<!--
  FILE    : docs/FIELD_SALES_PARTNER_PROGRAM_2026-11-06_1649.md
  PROJECT : Handled (HandledServices) — AI-run home & business services
  CREATED : 2026-11-06_1649 UTC
  UPDATED : 2026-11-06_1724 UTC — fits partner-v2: referrals keep the 25% / 10% / 15% job-price tiers; the ladder pays
            direct sales only; direct sales count 1.5× toward the level, referrals 1×.
  UPDATED : 2026-11-06_1738 UTC — partner-v4: referrals pay ONE rate on every job, 15% of the price rising to 30% (their
            own ladder, same level credit), locked on the job at booking; pro agreement v11.
  PURPOSE : Field Sales through the Partner Program (partner-v3): the two ways to earn (referrals and direct sales), the
            close-ready sales ticket, paying with a partner's code, the 10% → 45% direct-sales ladder (45% at $1M), how to
            turn it on, and the legal checks before recruiting on Indeed.
-->

# Field Sales: the Partner Program sales force

Partners earn on every completed job they bring to Handled. There are **two ways to earn**:

| | Way 1: Referrals | Way 2: Direct sales |
|---|---|---|
| Who sells | Handled sells; the partner sends the customer | The partner sells the service and writes a **sales ticket** |
| How | Referral ticket, link `/r/CODE`, or the partner's code typed at checkout | Partner page → **Write a sales ticket** |
| The customer pays | When they book | On the partner's phone right then (**Pay now on this phone**), or from the text/email we send |
| Pay | **One rate on every job: 15% → 30% of the job price** (the referral ladder below), half paid by the pro, locked on the job when it's booked | **The sales ladder: 10% → 45% of Handled's profit** on the job, paid by Handled alone (no pro fee) |
| Shown as | `X% of the job price · Referral` | `Direct sale · X% of profit` |
| Counts toward the ladder level | **1×** its profit | **1.5×** its profit |

Every customer belongs to one partner (the first one) for 12 months, repeat and recurring visits included. Repeat
visits from a customer the partner sold are also direct sales. Partners never take payment. Customers always pay
Handled through Stripe checkout.

## Way 2: the close-ready sales ticket

A partner can sell **any service in the catalog**. The ticket can't be sent until it holds everything needed to close,
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

While the partner fills it in, the form shows the **live upfront price** from the same engine as booking. Photos are
sent to the AI, which suggests the service and sizes. On send:

1. The customer is claimed for the partner (new customers only, not already another partner's).
2. The customer gets a text and email: *"your [service] is ready, $X, review & pay"* → `/book?ticket=…`.
3. The partner sees **Pay now on this phone** and **Copy pay link**, so they can close on the spot.
4. The booking opens with everything filled in: service, sizes, frequency, photos, notes, contact, address,
   timing, budget and access notes. The customer checks it, accepts the Service Agreement and pays. The AI photo check
   can still adjust the price within the normal limits, and some jobs need a free site visit.
5. **Paid → job board.** The job dispatches like any booking. Nothing goes to pros before it's paid. The job is
   marked `partner_sale`, so the pro's work order shows **no referral fee**.
6. **Completed → commission** at the partner's ladder rate, payable Monday after the 30-day guarantee.

Unbooked sales tickets expire after 30 days (daily sweep). The customer stays the partner's for 12 months.

### Paying with the partner's code
Any new customer can type a partner's code (e.g. `JANE7K2Q`) in the booking's code box. The booking shows *"✓ Partner
code JANE7K2Q — Jane gets credit"* (no discount), and the job is credited to that partner as a **referral**. A typed
code beats an earlier link click.

## The direct-sales ladder: 10% → 45% of profit

**Profit** = job price − pro payout − refunds (Handled's take). Direct-sale commissions come out of our share, never
the pro's pay.

- Every level is **+1 point**, from 10% (level 0) to 45% (level 35).
- A level is reached by **level credit**: lifetime profit generated for Handled, where **direct-sale profit counts
  1.5×** and **referral profit counts 1×**. The curve is **threshold(n) = $1,000,000 × (n ÷ 35)²**, rounded, so raises
  come quickly at the start and the top rate is at $1M of credit. That's about **$667k of direct-sale profit**.
- **Fast track:** every **10 job credits** (a direct-sale job is 1.5, a referral job is 1) is also +1 point, **up to
  20%**. Only profit takes anyone past 20%. The higher of the two counts.
- The rate is **locked when each direct-sale job is completed** and **never goes down**.
- The same level credit also sets the **referral rate** on its own ladder (next section).

| Rate | Level credit | Rate | Level credit |
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

## The referral ladder (partner-v4): 15% → 30% of the job price

- **One rate on every referred job**, the same on every service: 15% of the price (minus refunds) to start, +1 point per
  level to **30% at $1,000,000 of level credit**. Curve: threshold(n) = $1M × (n ÷ 15)². Fast track: +1 point per 10 job
  credits, up to 20%.
- **Same level credit** as the sales ladder (direct-sale profit 1.5×, referral profit 1×), so selling also raises the
  referral rate.
- **Locked on the job when it's booked** (`jobs.partner_rate`), so the pro sees their half on the work order before
  accepting. A recurring customer's next visit gets the partner's rate as it is then.
- **Half from the pro (7.5%–15% of the price), half from Handled.** Handled's half never exceeds what we keep after the
  card fee. A pro pays their half on a partner-v4 job only once they've signed **pro agreement v11**. Until then,
  Handled's half is all the partner gets on that job.
- **Jobs booked before partner-v4** (no `partner_rate`) keep their partner-v2 tier rate (25% / 10% / 15%), and a pro on
  v10 still pays their half on those.

| Referral rate | Level credit | Referral rate | Level credit |
|---|---|---|---|
| 15% | $0 (day one) | 16% | $4,400 |
| 17% | $18,000 | 18% | $40,000 |
| 19% | $71,000 | 20% | $111,000 |
| 21% | $160,000 | 22% | $218,000 |
| 23% | $284,000 | 24% | $360,000 |
| 25% | $444,000 | 26% | $538,000 |
| 27% | $640,000 | 28% | $751,000 |
| 29% | $871,000 | **30%** | **$1,000,000** |

**Direct sales vs. referrals, same $300 job, at the start.** A referral pays 15% of the price ($45: $22.50 from the
pro, $22.50 from us). A direct sale pays 10% of our profit ($7.50 on $75 of profit). If you want direct sales to pay more
than referrals from day one, change `PARTNER_LADDER` (see below).

To change the numbers, edit `PARTNER_LADDER` (sales) or `REFERRAL_LADDER` (referrals) in `packages/core/src/partners.ts`
(`baseRate`, `topRate`, `topProfit`, `curve`, `jobsPerStep`, `jobsCapRate`; the credit weights `directCredit` and
`referralCredit` are on `PARTNER_LADDER`; tests in `pricing.test.ts`), then bump `termsVersion`. A change to what pros
pay also needs a new `AGREEMENT_VERSION` (pros re-sign). Rates already locked on jobs don't change.

## Where it shows

| Page | What's there |
|---|---|
| `/partners` (public) | Two ways to earn, referral rates, how direct sales work, ladder milestones, sign-up. `?kind=sales_rep` pre-selects *Field Sales partner* |
| `/partner` (the partner) | Way 1 / Way 2 cards with earnings; direct-sales level and progress to the next raise; full ladder; referral ticket, link and code; **sales ticket form** and sales tickets (price shown, pay link, job status); payouts; commissions with rate |
| `/book?ticket=…` (the customer) | Everything pre-filled; "Jane set this up with you… you pay Handled directly" |
| Hub → Referral partners | Each partner's direct-sales rate and sales; the direct-sales ticket feed (with what's holding the customer back); commission queue (direct sales show "Direct sale · X% of our profit") |
| Home, header menu, footer, Careers, Network, Contact, sign-in | Both ways to earn; a Field Sales Partner listing on `/careers` |

## Turning it on
1. Supabase → SQL Editor → run `supabase/setup/ADD_FIELD_SALES_2026-11-06_1638.sql` and then
   `supabase/setup/ADD_REFERRAL_LADDER_2026-11-06_1800.sql` once each (after the partner-v2 file,
   `ADD_PARTNER_TICKETS_2026-10-28_0122.sql`). Safe to run twice. The Hub's go-live setup page shows them until they're run.
2. Twilio set up (Hub → Go-live setup) so sales tickets text the pay link. Without it, the email still goes out.
3. Deploy. The daily sweep expires old sales tickets, and Monday payouts already include direct-sale commissions.
4. Have your attorney review the updated partner terms (`partner-v4`), the pro agreement (v11) and the Indeed post
   before you recruit. Pros re-sign v11 before their next offer.

## Before you recruit on Indeed: talk to your attorney and CPA
- **Contractor vs. employee.** Partners are independent (1099), commission-only, set their own hours, and have no
  quota. Calling it a "part-time / full-time job" can make it look like employment. The Indeed post is written as
  *"work a few hours a week or make it your main income"*. Under federal law (FLSA), commission-only **outside
  salespeople** are generally exempt from minimum wage. Michigan and Washington have their own tests, so get a ruling
  before you lean on that.
- **Commission-only must be clear** in the post, with no guaranteed pay.
- **Texts:** only customers who asked to be contacted (the ticket requires that checkbox). Every text includes STOP.
- **Licensing:** partners sell Handled's services and never quote outside the app or promise work we didn't price.
- **1099s:** Stripe Connect collects tax details. Anyone paid $600+ in a year gets a 1099-NEC.
