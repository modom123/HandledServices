<!--
  FILE    : docs/LEAD_ENGINE_SETUP_2026-10-03_0332.md
  PROJECT : Handled (myhumanai) — AI-run home & business services
  CREATED : 2026-10-03_0332 UTC
  PURPOSE : Step-by-step: turn on automatic pro recruiting (auto-invite + the pro lead engine) with
            Google Places to find pros and Instantly.ai to send the invitations — LEAN setup
            (1 outreach domain, 2 inboxes, ~$50–60/month). Replaces the earlier guides.
            About 45 minutes, plus ~2 weeks of inbox warm-up in Instantly.
  UPDATED : 2026-10-04_1934 UTC — added "Business sales engine": the same setup pointed at property managers, brokerages,
            stagers, self-storage and stores, through a second Instantly campaign.
-->

# Turn on automatic pro recruiting — lean setup (Google Places + Instantly, ~$50–60/month)

**How it works:**
1. Every weekday morning our system finds pros (Google Places) and finds the email on each one's own website.
2. It writes each pro a personal 3-email invitation, with real pay for their trade and real local demand, and hands it to your **Instantly** campaign.
3. Instantly sends the emails from warmed-up inboxes and rotates between them. It respects the daily limits, stops when someone replies, and handles unsubscribes.
4. Instantly reports back to us: sent, clicked, replied, unsubscribed, bounced. When a pro applies, we tell Instantly to stop emailing them.

Steps 2–5 need your own accounts, so only you can do them. **Put API keys straight into Vercel; never paste them into chat or email.**

## 1. Turn on auto-invite and the lead engine (2 minutes)

1. Supabase → SQL Editor. If you haven't yet, run the new migrations first.
2. Paste and run **`supabase/setup/TURN_ON_RECRUITING_2026-10-03_0315.sql`**. It turns on:
   - **Auto-invite:** applicants scoring 70+ get their setup link automatically.
   - **Auto-activate:** pros go live once every step is verified.
   - **Lead engine:** on for cleaning, handyman/carpentry, remodeling, plumbing and electrical, with **5 searches/day and 20 new leads/day handed to Instantly**.
   - With the 3-step sequence, 20 new leads a day is about 60 emails a day. That's what 2 warmed-up inboxes can send safely.

## 2. Google Places API key — finds pros (10 minutes)

1. Go to **console.cloud.google.com**, create a project and link billing. A monthly free credit applies; at 5 searches a day expect about **$0–10/month**.
2. **APIs & Services → Library → "Places API (New)" → Enable.**
3. **Credentials → Create credentials → API key.**
4. Lock the key down:
   - API restrictions: **Places API (New) only**.
   - Application restrictions: **None**. The key is only used from Vercel's servers.
5. Recommended: under **Quotas**, cap the API at ~100 requests/day so it can never run up a bill.

## 3. Instantly — sends the invitations (30 minutes, then ~2 weeks of warm-up)

### 3a. Domain and inboxes (keep them separate from your booking emails)
1. **Buy one outreach domain** that's clearly yours, for example `joinhandled.com` (~$12/year). Never send cold email from the domain that sends customers their receipts.
2. **Create 2 inboxes** on it in Google Workspace (Business Starter, ~$7 each per month), for example `alex@joinhandled.com` and `team@joinhandled.com`. Use real names and a photo, since it helps replies. Each inbox sends about **30 emails per day**, so 60 a day in total.
3. On each domain, set up the DNS records your email provider gives you: **SPF, DKIM and DMARC**. For DMARC, add a TXT record named `_dmarc` with the value `v=DMARC1; p=none; rua=mailto:you@yourmaindomain.com`.
4. Point each domain's main website (`joinhandled.com`) at your real site, so curious pros land somewhere real.

### 3b. Instantly account
1. Sign up at **instantly.ai** on the **Growth plan (~$37/month)**. It includes unlimited warm-up and enough sending for 2 inboxes.
2. **Email Accounts → Add new** → connect each inbox → turn on **Warmup** for every inbox. **Wait about 14 days** before launching the campaign. During that time the engine can still find leads and fill the call list.
3. **Campaigns → New campaign**, named "Handled — pro invitations". Set it up like this:

   | Step | Delay before it | Subject | Body |
   |---|---|---|---|
   | 1 | — | `{{subject_1}}` | `{{body_1}}` |
   | 2 | 3 days | `{{subject_2}}` | `{{body_2}}` |
   | 3 | 5 days | `{{subject_3}}` | `{{body_3}}` |

   - **Every word of each email is written by our system per lead**, so in Instantly you only type these variables. The emails already include the real pay example, local demand, our postal address, an unsubscribe link and the Spanish link.
   - **Options:**
     - stop on reply: **on**;
     - open tracking: **off** (better delivery);
     - link tracking: **off** (our links already track clicks);
     - insert the unsubscribe link header: **on**;
     - daily limit: **30 per inbox** (60 total).
   - **Schedule:** weekdays, 8am–5pm Eastern.
   - **Accounts:** select both warmed-up inboxes.
   - **Launch** the campaign once warm-up is done. Leads we add before then wait in the campaign.
4. Copy the **campaign ID** from the campaign's URL or settings.
5. **Settings → Integrations → API Keys → create an API key (API v2)** with access to leads and the block list.
6. **Settings → Webhooks → add a webhook:**
   - URL: `https://YOUR-DOMAIN/api/webhooks/instantly?secret=YOUR_SECRET`. Make up a long random string as the secret, and use the same string for `INSTANTLY_WEBHOOK_SECRET` below.
   - Events: **email sent, link clicked, reply received, lead unsubscribed, email bounced**. Choose "all campaigns" or this campaign.

## 4. Your business postal address

Federal law (CAN-SPAM) requires a real postal address in every commercial email. A PO box or virtual mailbox is fine, but it must receive mail.

## 5. Put it all in Vercel (5 minutes)

Vercel → project → **Settings → Environment Variables** (Production):

| Name | Value |
|---|---|
| `GOOGLE_PLACES_API_KEY` | the Google key from step 2 |
| `INSTANTLY_API_KEY` | the Instantly API v2 key |
| `INSTANTLY_CAMPAIGN_ID` | the campaign ID |
| `INSTANTLY_WEBHOOK_SECRET` | the random string used in the webhook URL |
| `BUSINESS_POSTAL_ADDRESS` | e.g. `Handled Services LLC, PO Box 1234, Detroit, MI 48201` |

Then **Redeploy** the latest production deployment. New variables apply only after a redeploy.

## 6. Check it

1. Hub → **Go-live setup**: both lead engine checks should be green.
2. Hub → **Pro leads**: all keys should show ✓.
3. **Test with yourself:**
   - Import this 2-line CSV, then click **Run now**:
     ```
     business_name,contact_name,email,trade,city
     Test Cleaning Co,Your Name,your-own-email@example.com,cleaning,Detroit
     ```
   - In Instantly → the campaign → Leads, you should see yourself, with subject_1…3 and body_1…3 filled in.
   - Once the campaign is live, check that the email arrives, the links open the sign-up page, the Spanish link opens it in Spanish, and replying shows "replied" in Hub → Pro leads.
4. **Grow only when you need more applicants.** Add a third inbox (+$7/month; warm it 2 weeks) and raise "Emails / day" in Hub → Pro leads from 20 to 30. Every 2 more inboxes, add a second domain. Never push one inbox past ~30 a day; add inboxes instead. Grow only while bounces stay under ~3% and spam complaints near zero.

## Day to day
- **Replies** arrive in Instantly's **Unibox**. Answer there, then mark the lead in Hub → Pro leads if needed.
- **Applicants** appear in Hub → **Recruiting**, credited to the lead they came from. Instantly is told to stop emailing them automatically.
- **Phone-only leads** wait in the Hub call list, with a short script. We never send automated texts.

## Monthly cost (lean)

| Item | Cost |
|---|---|
| Instantly Growth | ~$37 |
| 2 inboxes (Google Workspace) | ~$14 |
| 1 outreach domain | ~$1 |
| Google Places (5 searches/day) | $0–10 |
| **Total** | **about $50–60 a month** |

That covers about 60 invitation emails a day, which reaches ~400 new pros a month across the 3 emails.

## Business sales engine (customers, not pros)

The same machinery finds **business customers**: property managers, real estate brokerages, home stagers,
self-storage facilities and furniture & appliance stores. It sends them a 3-email sequence with a pilot offer
(default: up to 20% off their first 2 jobs, always from our share). About 15 minutes once recruiting is running:

1. **Instantly → Campaigns → New campaign** named "Business sales". Same template as the pro campaign: 3 steps
   with subject `{{subject_1}}` / body `{{body_1}}`, then `{{subject_2}}`/`{{body_2}}` (wait 4 days) and
   `{{subject_3}}`/`{{body_3}}` (wait 6 days). Use the same warmed-up inboxes; keep total sends per inbox under ~30 a day.
2. Copy the campaign id into **Vercel → Environment Variables** as `INSTANTLY_BIZ_CAMPAIGN_ID` (Production), then redeploy.
   Don't paste keys into chat or email.
3. **Hub → Business leads:** tick "Engine on", pick the segments, set the pilot offer, Save. Start with
   5 searches and 20 new sequences a day.
4. The existing Instantly webhook already reports business replies, clicks and unsubscribes.

**Day to day:** answer business replies in Instantly's Unibox the same day (they're warm), and call the
phone-only list in Hub → Business leads. Send LinkedIn messages yourself; automating LinkedIn breaks its rules.
When a business sets up an account from the email link, the pilot is applied automatically and you get an alert
to call them and book the first job.
