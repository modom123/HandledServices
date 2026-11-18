<!--
  FILE    : docs/SALES_FORCE_CAREER_PATH_2026-11-18_0020.md
  PROJECT : Handled (HandledServices) — AI-run home & business services
  CREATED : 2026-11-18_0020 UTC
  UPDATED : 2026-11-18_0050 UTC — promotions on counts (deals in 90 days, active clients, team deals / clients); everyone starts
            from zero; three paths to $100K from commercial business services; business pricing (up to 50%, pros paid home dollars).
  UPDATED : 2026-11-18_0100 UTC — promotions follow the money: profit made for Handled (90 days, own and team) is the main measure.
  PURPOSE : The Handled Sales Force: a career path from Associate Account Executive to VP of Sales, built on the
            Partner Program's 15% → 45% ladder. PROPOSAL — review with an attorney before it goes live in payouts.
-->

# The Handled Sales Force: Associate AE to VP of Sales

The Partner Program's **15% → 45% of our profit** ladder was always meant to let people grow. This plan keeps that
range and turns each step into a **title with clear targets**, so a rep can see the next promotion in weeks, not at
$1M of lifetime profit. People grow as the company grows: new cities become promotions, the top ranks move to a
salary, and leaders share in the profit they build.

## The promotion chart (everyone starts from zero)

Commission rises with the money a rep makes Handled, and promotions follow the same number: **the profit their clients
brought Handled in the last 90 days** (their team's, for leaders). Profit = what Handled keeps after paying the pro, on
every job their clients book, new and repeat. Deals and active clients are minimums, so the profit comes from real,
lasting clients. A **deal** is a new client's first paid job or contract; an **active client** booked in the last 90
days or is on a recurring plan.

| Rank | Commission (of profit) | Team share | Profit you make Handled | Team profit | Your deals | Active clients | Also | Bonus |
|---|---|---|---|---|---|---|---|---|
| Associate AE | **15%** | — | — | — | — | — | Sales Academy | — |
| Account Executive | **20%** | — | **$5,000** | — | 5 | 3 | Academy | $250 |
| Senior AE | **25%** | — | **$20,000** | — | 9 | 10 | refunds < 5% | $500 |
| Principal AE | **35%** | — | **$60,000** | — | 12 | 30 | refunds < 5% | $1,500 |
| Team Lead | **30%** | 8% | $5,000 | **$75,000** | 3 | — | 3 reps with a deal; 18 team deals; 40 team clients | $1,000 |
| Sales Manager | **35%** | 5% | $5,000 | **$250,000** | 3 | — | 2 Team Leads, 10 reps; 60 team deals; 150 team clients | $2,500 |
| Director of Sales | **40%** | 4% | $5,000 | **$750,000** | 3 | — | 3 Managers; 180 team deals; 500 team clients | $5,000 |
| VP of Sales | **45%** | 3% | $5,000 | **$2,000,000** | 3 | — | 2 Directors; 450 team deals; 1,500 team clients; owner approval | $10,000 |

All numbers are over the last 90 days. From zero, with $1,500-a-month accounts: at 4 deals a month (about one a week)
a rep reaches AE in month 2, Senior AE in month 4 and Principal AE in month 9; at 3 a month, AE in month 2 and Senior AE
in month 5; at 2 a month they stay an AE.

## Three ways to $100K a year (commercial business services)

Business pricing lets Handled keep up to 50% on business work (pros are paid the same dollars as at home prices), so a
$1,500-a-month office account earns about $749 of profit a month.

| Path | Who | What they do | Year 1 | Year 2 on |
|---|---|---|---|---|
| Top seller | Senior AE | 3 walkthroughs a week, ~1 new account a week | $56,053 | **$106,971** |
| Big accounts | Principal AE | 3 larger accounts a month | $57,775 | **$109,929** |
| Team builder | Team Lead | 6 reps closing 2 accounts a month each, plus 1 own | $66,990 | **$119,385** |

Assumptions: $1,500-a-month accounts, 1 in 3 walkthroughs becomes an account, 3% of accounts leave each month.

After Senior AE, people choose: keep selling (Principal AE) or lead (Team Lead → VP). Both pay well, and people can switch.

## Growing with the company

- **Salary at the top:** Directors $75,000, the VP $120,000 (W-2), on top of commission, once the profit they lead
  supports it ($250,000 / $1,000,000 a quarter).
- **Profit share:** Directors 2% of their region's net profit; the VP 1% of company net profit; paid quarterly.
- **New markets:** each new city opens a Director and a Manager seat; current leaders get first claim.
- **Rank protection:** a rank is lost only after 2 quarters in a row under half its targets.

## Pay rules

- Paid on **our profit** (price − pro payout − refunds), shown to the rep **in dollars** before they sell.
- The whole sales force together gets at most **60% of our profit** in a new customer's first 12 months. A full
  chain (Principal 35% + Team Lead 8% + Manager 5% + Director 4% + VP 3%) is 55%. Handled keeps every unfilled share.
- **Book share** after year one, while the rep is active: they keep earning on accounts they keep happy.
- **Fast money:** $25 per walkthrough held (up to 20 a week), $100 for the first sale.
- **Paid every Monday** once the job is done and paid; taken back if refunded within 30 days.
- **Not a pyramid:** no fees or purchases; leaders earn only on real paid jobs, never on sign-ups, and must keep
  selling ($2,000 personal profit a quarter) to earn on their team.

## Example months (illustrations, not promises; ~$100 profit per home job, $375/month per office account)

- Account Executive, month 4: **$1,275** (20 home jobs, 2 new accounts, 6 earlier accounts paying)
- Senior AE: **$2,206** (10 home jobs, 4 new accounts, 15 accounts paying)
- Sales Manager: **$3,838** (own sales plus 5% of a team bringing in $40,000 profit a month)

## Status

- Rules and tests: `packages/core/src/sales-force.ts` (pricing.test.ts)
- Careers page preview: `/careers/sales` (not indexed, not linked yet)
- **Not live yet:** today's payouts still use the Partner Program ladder. Going live needs: ranks and who-reports-to-whom
  in the database, payouts using `salesPay()`, walkthrough and first-sale bonuses, a promotion check each quarter,
  the rep's "next promotion" card in the partner app, a Hub page to manage the team, and attorney review.
