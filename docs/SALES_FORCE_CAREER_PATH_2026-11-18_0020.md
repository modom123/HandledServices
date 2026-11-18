<!--
  FILE    : docs/SALES_FORCE_CAREER_PATH_2026-11-18_0020.md
  PROJECT : Handled (HandledServices) — AI-run home & business services
  CREATED : 2026-11-18_0020 UTC
  PURPOSE : The Handled Sales Force: a career path from Associate Account Executive to VP of Sales, built on the
            Partner Program's 15% → 45% ladder. PROPOSAL — review with an attorney before it goes live in payouts.
-->

# The Handled Sales Force: Associate AE to VP of Sales

The Partner Program's **15% → 45% of our profit** ladder was always meant to let people grow. This plan keeps that
range and turns each step into a **title with clear targets**, so a rep can see the next promotion in weeks, not at
$1M of lifetime profit. People grow as the company grows: new cities become promotions, the top ranks move to a
salary, and leaders share in the profit they build.

## The ladder

| Rank | Path | Your sales (profit share) | Your book, year 2+ | Your team's sales | Promotion bonus | To get there (90 days) |
|---|---|---|---|---|---|---|
| Associate AE | Start | **15%** | — | — | — | Where everyone starts |
| Account Executive | Seller | **20%** | 5% | — | $250 | 5 paid sales, $2,500 profit, Academy |
| Senior AE | Seller | **25%** | 8% | — | $500 | $15,000 profit, 3 active accounts, refunds < 5% |
| Principal AE | Seller | **35%** | 10% | — | $1,500 | $45,000 profit, 10 active accounts |
| Team Lead | Leader | **30%** | 8% | 8% | $1,000 | 3 reps with a paid sale, $25,000 team profit |
| Sales Manager | Leader | **35%** | 8% | 5% | $2,500 | 2 Team Leads, 10 reps, $75,000 team profit |
| Director of Sales | Leader | **40%** | 10% | 4% | $5,000 | 3 leaders, $250,000 team profit |
| VP of Sales | Leader | **45%** | 10% | 3% | $10,000 | 2 Directors, $1,000,000 team profit, owner approval |

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
