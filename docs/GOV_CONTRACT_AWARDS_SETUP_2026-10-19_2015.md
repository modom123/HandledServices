<!--
FILE    : docs/GOV_CONTRACT_AWARDS_SETUP_2026-10-19_2015.md
PROJECT : Handled (HandledServices) — AI-run home & business services
CREATED : 2026-10-19_2015 UTC
PURPOSE : How to get the SAM.gov API key into Vercel and use Hub → Gov contracts → Awards & recompetes
          (SAM.gov Contract Awards API, https://open.gsa.gov/api/contract-awards/).
UPDATED : 2026-10-19_2140 UTC — subcontracting under primes; focus codes (landscaping, painting, AI automation,
          window installation, carpet cleaning, construction).
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
2. **Set the state** (MI). SAM returns only contracts performed there.
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

## 4. Subcontracting under primes (the main goal)
**Subcontract targets** (top of the Awards page) lists prime contractors doing our focus work **right now**, best first.

Focus codes (★, picked by default):

| Work | NAICS | How we deliver it |
|---|---|---|
| Landscaping | 561730 | Our pros |
| Painting | 238320 | Our pros |
| Carpet cleaning | 561740 | Our pros |
| Construction | 236220 commercial building, 236118 remodeling | Our pros; Davis-Bacon wages and bonds apply |
| Window installation | 238150 glass & glazing | Subcontracted pros (no catalog service yet) |
| AI automation | 541511, 541512, 541519 | Remote, so the state doesn't matter |

Custodial (561720) and roofing (238160) are still selectable.

**Subcontract score (0–100):**

| Factor | Points |
|---|---|
| Our work | +20 |
| Michigan (or remote AI work) | +20 (+30 for remote AI work) |
| Metro Detroit | +10 more |
| Large-business prime | +20 |
| Has a subcontracting plan | +15 |
| 6+ months left on the contract | +15 |
| Worth $750K+ | +5 |

Ended contracts score 10 at most. Large primes over $750K usually have to file a small-business subcontracting plan (FAR 19.7) and report against it, so they look for small subs.

**How to work a target:**
1. Open the prime. You'll see its contracts, phone, address and UEI, plus a pitch you can copy.
2. Look up the UEI on SAM.gov (Entity Information) for its small-business liaison.
3. Call or email with the pitch. Send the capability statement, insurance certificates and references.
4. Before any subcontract: the wage determination (SCA / Davis-Bacon) flows down to us and our pros, and on a small-business set-aside the prime has limits on subcontracting (FAR 52.219-14). Check both with counsel.

**AI automation:** clear the state and search the 5415xx codes on their own to see primes nationwide. Keep the trades in MI.

**Database:** run `supabase/setup/ADD_GOV_SUBCONTRACTING_2026-10-19_2140.sql` once, after the awards file.

## What the API does (for whoever maintains this)
Checked against GSA's published OpenAPI spec ("Contract Award API", version 1.0).
- `GET https://api.sam.gov/contract-awards/v1/search?api_key=…`. There's also `/contract-awards/v1/download` for large extracts (`format=csv`), which we don't use.
- **Paging:** `limit` (default 10, max 100) and `offset` (the spec's default is 1). The spec doesn't say whether `offset` counts pages or records. The code starts with page numbers and checks the second page: if it comes back shifted by one record, it switches to record offsets (`nextAwardOffset`). Only the first 400,000 records are returned.
- **Filters used:**
  - `naicsCode` (`~` = OR, `!` = NOT)
  - `dateSigned=[MM/dd/yyyy,MM/dd/yyyy]`
  - `placeOfPerformStateCode`. The state is filtered by SAM, so no calls are wasted on other states.
  - `q` (free text) and `awardeeUniqueEntityId`
- **Other filters in the spec**, for later: `typeOfSetAsideCode`, `contractingDepartmentCode`, `contractingSubtierCode`, `productOrServiceCode`, `ultimateCompletionDate`, `currentCompletionDate`, `fiscalYear`, `piid`, `awardeeLegalBusinessName`.
- **Response:** `totalRecords`, `limit`, `offset`, `piidAggregation`, and `awardSummary[]`. Each award has:
  - `contractId`: piid, modificationNumber, referencedIDVPiid
  - `coreData`: federalOrganization.contractingInformation, principalPlaceOfPerformance, solicitationId
  - `awardDetails`: dates, dollars, totalContractDollars, productOrServiceInformation (principalNaics, productOrService, descriptionOfContractRequirement), competitionInformation (typeOfSetAside, numberOfOffersReceived), and awardeeData (awardeeHeader, awardeeUEIInformation, awardeeLocation)
- The parser (`packages/core/src/gov-awards.ts`) reads those exact paths first and falls back to finding fields by name. The full raw record is kept in `gov_awards.raw`.
- **Still to confirm on the first live call:** the `dateSigned` range format and how `offset` counts.
- Docs: https://open.gsa.gov/api/contract-awards/. Alpha (test) host: `api-alpha.sam.gov`, with a key from alpha.sam.gov.
