<!--
  FILE    : docs/JOB_POSTING_LEADS_2026-10-07_2030.md
  PROJECT : Handled (HandledServices) — AI-run home & business services
  CREATED : 2026-10-07_2030 UTC
  PURPOSE : How automatic job-posting leads work and how to turn them on.
-->

# Job-posting leads (automatic)

Every weekday the system finds businesses in **Michigan and Washington** that are hiring for work Handled does. It searches for cleaner, janitor, custodian, housekeeper, porter, maintenance technician and groundskeeper roles, then pitches each business the work as a service instead of a hire.

## How it runs (no one has to touch it)
1. **Find:** search Adzuna's job-search API (a licensed aggregator of postings from many job boards) for those roles in 16 cities. These are 8 in Michigan (Detroit, Ann Arbor, Troy, Grand Rapids, Lansing, Flint, Kalamazoo, Saginaw) and 8 in Washington (Seattle, Bellevue, Tacoma, Everett, Spokane, Olympia, Vancouver, Kent), rotated daily, covering the last 14 days. Indeed itself is never scraped; its terms don't allow it.
2. **Screen:** keep only businesses hiring for work we do. Skip cleaning companies (competitors), staffing agencies, unnamed employers, companies already in the leads list, and anything outside MI or WA. Each lead is tagged as property manager, real estate, storage, retail, or offices & facilities.
3. **Fill in:** Google Places adds the company's website and phone. The enrichment step finds the email address on its website.
4. **Reach out:** the 3-email "book it as a service instead of hiring" sequence (day 0, 4 and 10) goes out through Instantly, with the job title they posted and a pilot offer. Replies, unsubscribes and bounces come back automatically.
5. **Call list:** leads with no email go on the call list in Hub → Business leads, with the posting link, the posted pay and a ready-made letter.

## Turn it on (one time)
1. Get a free API key at **developer.adzuna.com** and add `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` in Vercel.
2. Run `supabase/setup/ADD_JOB_POST_DISCOVERY_2026-10-07_2030.sql` in Supabase → SQL Editor.
3. Make sure these are set: `GOOGLE_PLACES_API_KEY`, `INSTANTLY_API_KEY`, `INSTANTLY_BIZ_CAMPAIGN_ID` and `BUSINESS_POSTAL_ADDRESS`. Hub → Setup shows what's missing.
4. Hub → Business leads → turn the engine on and set **Job-posting searches/day** (default 6). Press **Find job postings now** to run it immediately.

## What stays human
- Walkthroughs, quotes and closing.
- Calls to leads with no email.
- Cold email goes to businesses only. No automated texts or calls (TCPA rules).
