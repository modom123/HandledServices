<!--
FILE    : docs/GOV_CONTRACT_AWARDS_SETUP_2026-10-19_2015.md
PROJECT : Handled (HandledServices) — AI-run home & business services
CREATED : 2026-10-19_2015 UTC
PURPOSE : How to get the SAM.gov API key into Vercel and use Hub → Gov contracts → Awards & recompetes
          (SAM.gov Contract Awards API, https://open.gsa.gov/api/contract-awards/).
-->
# Government contract awards (SAM.gov): setup

Two SAM.gov APIs, one key:

| Hub page | SAM.gov API | What it tells you |
|---|---|---|
| Gov contracts | Get Opportunities (`/opportunities/v2/search`) | Open bids you can respond to now |
| Gov contracts → **Awards & recompetes** | Contract Awards (`/contract-awards/v1/search`) | Contracts already awarded: who holds the work, what it's worth, when it ends |

Awards are how you get ahead of a bid. Agencies usually post the follow-on 3–12 months before a contract ends. A janitorial contract in Detroit that ends in 8 months is a lead **today**: learn the incumbent and their price, meet the contracting office, and answer the sources-sought notice when it posts.

## 1. Get the SAM_API_KEY (you make it — nobody can give it to you)
The key is tied to your own SAM.gov login, so only you can create it.
1. Go to **sam.gov** and sign in (or create a free account; it uses Login.gov).
2. Click your name (top right) → **Workspace** → **Profile** (Account Details).
3. Find **Public API Key** → enter your password again → **Generate**. If you already have one, click the eye icon to show it.
4. Copy the key. It's a long string of letters and numbers.
5. In **Vercel → your project → Settings → Environment Variables**, add:
   - Name: `SAM_API_KEY`
   - Value: the key you copied (paste it there only, never in chat, email or code)
   - Environments: Production (and Preview if you test there)
6. **Redeploy** so the site picks it up.

Notes:
- Keys **expire every 90 days**. SAM.gov emails you before that. Generate a new one, replace it in Vercel and redeploy.
- A personal key allows about **10 calls a day**. Once Handled is registered in SAM.gov and your account has a role at the entity, it's about **1,000 a day**.
- Opportunities and awards share this budget. Hub → Gov contracts shows how many calls are left today.

## 2. Run the database update (once)
Supabase → SQL Editor → paste `supabase/setup/ADD_GOV_CONTRACT_AWARDS_2026-10-19_2015.sql` → Run. It's safe to run twice. CLI users: `supabase db push`.

## 3. Search awards
In Hub → Gov contracts → **Awards & recompetes**:
1. **Pick the NAICS codes.** They all go in one call, joined as `naicsCode=561720~561730`.
2. **Set the state** (MI). Only contracts performed there are kept.
3. **Set "signed in the last" months.** 24 is a good start; most service contracts run 1 base year plus 4 option years.
4. **Set pages of 100.** Each page is one call. Keep it at 1–2 on a personal key.
5. Optional: **keywords** (free text, the `q` parameter) or an **awardee UEI** (one company's contracts).
6. **Search awards.** Modifications are merged into one row per contract, with the latest end date and highest value.
7. Tick **Refresh awards every Monday morning** to run it automatically. It uses the NAICS codes and state from the opportunities search.

**Recompete fit (0–100):**

| Factor | Points |
|---|---|
| Our NAICS code | +35 |
| Michigan | +20 |
| Metro Detroit | +15 more |
| Ends in 3–18 months (the re-bid window) | +25 |
| Ends in 18–36 months | +10 |
| Open or small-business set-aside, or one we're certified for | +5 |
| Only one offer last time | +5 |
| Already ended | −30 |
| Certification set-aside we don't hold | −15 |

Use **Watch** / **Ignore** to sort leads. **Who holds this work now** lists incumbents by total value. Big ones are also subcontracting prospects.

## What the API does (for whoever maintains this)
- `GET https://api.sam.gov/contract-awards/v1/search?api_key=…`
- **Paging:** `limit` (default 10, max 100) and `offset`. Only the first 400,000 records are returned.
- **Filters used:** `naicsCode` (`~` = OR, `!` = NOT), `dateSigned=[MM/dd/yyyy,MM/dd/yyyy]`, `q` (free text) and `awardeeUniqueEntityId`.
- **Response:** `totalRecords`, `limit`, `offset`, `awardSummary[]`. Each award has `contractId` (piid, modificationNumber, …), `coreData` (agency, NAICS, PSC, set-aside, place of performance), and `awardDetails` (dates, dollars, awardee).
- The parser (`packages/core/src/gov-awards.ts`) finds fields by name, so small changes in nesting don't break it. The full raw record is kept in `gov_awards.raw`.
- **Place of performance is filtered on our side.** If you confirm a server-side state filter in the docs, add it in `awardSearchQueries` to save calls.
- Docs: https://open.gsa.gov/api/contract-awards/. Alpha (test) host: `api-alpha.sam.gov`, with a key from alpha.sam.gov.
