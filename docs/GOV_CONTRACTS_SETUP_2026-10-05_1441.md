<!--
FILE    : docs/GOV_CONTRACTS_SETUP_2026-10-05_1441.md
PROJECT : Handled (myhumanai) — AI-run home & business services
CREATED : 2026-10-05_1441 UTC
PURPOSE : How to switch on government contract search (SAM.gov) in the Hub, and what to check before bidding.
-->
# Government contracts (SAM.gov): setup

**Hub → 🏛️ Gov contracts** searches federal contract opportunities on SAM.gov for the work our pros do. It scores each notice for fit, writes an AI bid brief, and helps you line up pros before you bid.

## 1. Get a SAM.gov API key (5 minutes)
1. Sign in (or create an account) at **sam.gov**.
2. Open **Workspace → your profile → Public API Key** and generate a key.
3. In **Vercel → Settings → Environment Variables**, add `SAM_API_KEY` with that key. Type it there only, never in chat or email. Redeploy.

**Call limits.** A personal key gets about **10 calls a day**. Once Handled is registered in SAM.gov and your account has a role at the entity, you get about **1,000 a day**.
- Each search uses one call per NAICS code.
- Loading a notice's full text uses one call.
- Everything is cached, and the Hub shows how many calls are left today.
- Keep the "daily call budget" at 8 until you have the higher limit.

## 2. Pick the work and switch on the daily search
In Hub → Gov contracts:
1. Pick the NAICS codes. Defaults: janitorial 561720, grounds 561730, snow/power washing 561790, security 561612, hauling 562111, moving 484210.
2. Set the state (MI), the notice types and how many days back to search.
3. Tick **Run this search every weekday morning**.

The cron runs at 13:10 UTC (9:10 am Detroit, summer time).

## 3. Working a notice
- **Fit score (0–100):**
  - +40 for our NAICS code.
  - +25 for Michigan, +15 more for metro Detroit.
  - +10 for open, small-business, or set-asides we're certified for.
  - +10 for a week or more to respond.
  - Certification-only set-asides, passed deadlines and award notices score low.
- **AI bid brief:** scope, place, period, wage rules, insurance, site visit, deadlines, risks, pros needed, and bid / maybe / pass. Always check it against the solicitation and attachments on SAM.gov.
- **Pros who could fill it:** approved pros whose trades match. **Ask pros** emails them:
  - Do they want it?
  - What capacity can they cover?
  - What's their rate?
  - Are they a small business?

  The email says it isn't an offer of work yet. Record each answer in the table.
- **Pipeline:** new → reviewing → bidding → submitted → won / lost, or passed.

## 4. Before the first bid (talk to counsel or a government-contracts adviser)
- **Register Handled in SAM.gov.** Entity registration is free and gives you a UEI. It takes 2–4 weeks the first time and must be renewed every year. List the NAICS codes you'll bid under.
- **Check the size standard.** Confirm Handled is "small" for each NAICS code (SBA size standards).
- **Limits on subcontracting (FAR 52.219-14).** On small-business set-asides for services, at most 50% of what the government pays us can go to subcontractors that aren't "similarly situated". Pros that are small businesses for that NAICS code count as similarly situated. Get each pro's size confirmed in writing. Open (unrestricted) contracts don't have this limit.
- **Wages.** Under the Service Contract Act (service contracts over $2,500), every worker is paid at least the wage determination plus fringe, including subcontractors' workers. Construction work over $2,000 falls under Davis-Bacon, with weekly certified payrolls. Price for it and flow the clauses down.
- **Pros stay independent.** Use written subcontracts with the required flow-down clauses, measure results, not methods, and never call pros employees.
- **Cash flow.** The government pays about 30 days after a proper invoice (IPP or PIEE/WAWF). We pay pros sooner, so plan for that gap.
- **Site access.** Badges, background investigations and base passes take time. Build that into the start date.

## Other places to find public work (by hand)
- **Michigan state contracts:** SIGMA VSS.
- **Cities, counties, schools:** BidNet Direct / MITN, plus each city's purchasing page (Detroit, Wayne, Oakland and Macomb counties).
- **Subcontracting to big primes:** SBA SubNet, and the small-business liaisons at large federal contractors.
