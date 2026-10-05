<!--
  FILE    : docs/BIZ_OUTREACH_COVER_LETTER_2026-10-05_0130.md
  PROJECT : Handled (myhumanai) — AI-run home & business services
  CREATED : 2026-10-05_0130 UTC
  PURPOSE : The job-posting letter to prospective business clients: where it lives in the system, how to use it,
            and what changed from the owner's draft (docs/COVER_LETTER_ORIGINAL_2026-10-05_0130.pdf) and why.
-->

# Job-posting outreach letter

**Who gets it:** a business that posted a job (Indeed, ZipRecruiter, Craigslist…) for a cleaner, handyman,
maintenance tech, groundskeeper, painter or mover. The pitch: book that work as a service instead of hiring for it.

## How to use it (Hub → Business leads)
1. Find a posting by hand on the job site. The job sites don't allow scraping, so we don't automate this step.
2. Get the business email from the company's own website.
3. In **Add a business from a job posting**, enter the business name, the job title and the posting site and link.
   The email, contact name and city are optional.
4. Choose how to send it:
   - **With an email:** the 3-email sequence (day 0, 4, 10) goes out through the Instantly business campaign,
     right away if you tick "Start now". Replies, unsubscribes and bounces come back automatically.
   - **Without an email:** the lead goes to the call list.
   - **By hand:** click **letter** to print it, save it as a PDF or copy it into a message. It's signed with your
     name and has the lead's own sign-up link, so the pilot offer is applied automatically when they set up an account.

The wording adapts to the job title. A cleaning role pitches turnover and office cleaning, a grounds role pitches
lawn and snow, and a mover or driver role pitches moves and delivery. Any other title gets maintenance and repairs.

## What changed from the draft, and why
| Draft | Now | Why |
|---|---|---|
| "Net-30 invoicing" for every partner | "Invoicing is available for approved accounts" | Terms are case by case; every account starts on prepay |
| "No surprise stair or fuel surcharges" | "The price only changes if the job turns out different from what you described, and only after you approve it" | Change orders exist; we can't promise a price never changes |
| "pairs physical labor with vetted local workers" | "a vetted, insured local pro does the job" | We sell a finished service, not labor the client directs. This keeps pros independent and avoids looking like a staffing agency |
| "Dedicated account dispatch, priority routing" | "Your favorite pros get your jobs first" | That's what the system actually does (first look) |
| "GPS live tracking" | "Live arrival tracking and before-and-after photos" | Matches the product |
| "ID and background-checked, licensed where required, rated" | Same, plus "insured" | Every pro carries liability insurance |
| Guarantee "within 30 days" | Pulled from the brand setting (currently 30 days) | Stays in sync if it changes |
| Placeholders such as [Your Company Name] | Filled automatically: business, job title, posting site, city, pilot offer, sign-up link | — |
| — | Business postal address and a one-click unsubscribe on every email | Required by CAN-SPAM |

Code: `packages/core/src/biz-lead-engine.ts` (bizLeadEmail, bizCoverLetter, jobPostNeed) ·
`apps/web/lib/biz-leads.ts` (addJobPostLead) · `apps/web/app/hub/biz-leads/[id]/letter/page.tsx`.
