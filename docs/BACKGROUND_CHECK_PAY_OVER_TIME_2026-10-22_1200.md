<!--
  FILE    : docs/BACKGROUND_CHECK_PAY_OVER_TIME_2026-10-22_1200.md
  PROJECT : Handled (HandledServices) — AI-run home & business services
  CREATED : 2026-10-22_1200 UTC
  PURPOSE : How new pros get a background check without paying up front: Handled pays Checkr, the pro repays it from
            completed jobs, nothing is owed without jobs, and early-job refunds. Setup, rules, and what pros see.
-->

# Background check — paid over time

Checkr charges about $30–$89 per check, depending on the package. An upfront bill stops good pros from finishing
onboarding, so:

1. **Handled pays Checkr** when the pro's first check is ordered (automatically, once their W-9 and agreement are in).
2. **The pro repays it from completed jobs**: a set amount per job (default **$10**), never more than a set share of that
   job's pay (default **25%**). It's its own line on their payout statement ("Background check repayment — $10 ($20 of $45
   repaid, $25 to go)"), netted in the Monday payout.
3. **No jobs, nothing owed.** Repayments only ever come out of payouts, and we never bill or send anything to collections.
   A pro who doesn't pass, or never works, costs us the check. That's the cost of recruiting.
4. **Early-job refund (optional):** complete **25 jobs in the first 90 days** and we pay back everything repaid, and nothing
   more is taken. The daily sweep does this automatically and emails the pro.
5. **Yearly re-checks are on us.**

Example with a $45 check and $112 jobs: $10 comes out of each of the first 4 jobs and $5 out of the 5th, so it's repaid
after 5 jobs. If the pro reaches 25 jobs in their first 90 days, the $45 comes back on their next payout.

## Turn it on

1. Run `supabase/setup/ADD_BACKGROUND_CHECK_OVER_TIME_2026-10-22_1200.sql` in Supabase (also in the combined
   `RUN_ONCE_REFERRALS_ALL_*.sql`).
2. **Hub → Pro Program → 7 · Background check**:
   - **Fee** is the exact price Checkr charges you for the package in `CHECKR_PACKAGE`. Never more: charging more than cost
     raises legal and trust problems.
   - Set the per-job amount, max share of a job's pay, and the refund rule (0 jobs means no refund). Tick **Offered**, then save.
   - Fee 0 or Offered off means Handled pays, as before.
3. **The fee is locked per pro** when their check is ordered. Changing the setting later only affects new pros.

## What pros see

- **Onboarding → Background check step:** "We pay Checkr now ($45). You repay $10 from each completed job (never more
  than 25% of that job's pay). No jobs, nothing owed. Complete 25 jobs in your first 90 days and we refund all of it."
  This is in English and Spanish, with "repaid so far" once it's running.
- **Contractor agreement v10, section 22** has the same terms. The agreement is signed before the check is ordered.
- **Earnings / payout statement:** each repayment and the refund are their own lines, labelled "Background check" in the app.

## Staff

- **Hub → Pros → a pro:** "🔎 Background check" shows "On us", or "$20 / $45" repaid, or "Refunded".
- **Safety:** every balance change is a compare-and-set, so a repayment can't be taken twice. The database refuses to
  record more repaid than the fee.

## Check with counsel before switching it on

Some states limit charging workers for background checks. Most of those rules are written for employees, and pros are
independent contractors, but confirm for **Michigan and Washington** (and any new state). Deductions from contractor pay
need the written agreement, which section 22 provides.

Code: `packages/core/src/pro-policy.ts` (`backgroundCheck`, `backgroundInstallment`, `backgroundRefund`, tested in
`partners.test.ts`), `apps/web/lib/background-fee.ts`, `lib/recruiting.ts` (`orderBackgroundCheck`), `lib/jobs.ts`
(`finalizeJob`), the cron sweep, and `supabase/migrations/20261022120000_background_check_over_time.sql`.
