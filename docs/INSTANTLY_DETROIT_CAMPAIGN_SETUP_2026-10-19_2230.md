<!--
FILE    : docs/INSTANTLY_DETROIT_CAMPAIGN_SETUP_2026-10-19_2230.md
PROJECT : Handled (HandledServices) — AI-run home & business services
CREATED : 2026-10-19_2230 UTC
PURPOSE : Wire the Instantly campaign "1ST OUTREACH DETROIT" (3de836a0-4845-4350-80af-db9725831b43) to the AI agents
          and the CRM (Hub → Business leads).
-->
# Instantly "1ST OUTREACH DETROIT" → AI agents + CRM

**Campaign ID:** `3de836a0-4845-4350-80af-db9725831b43` · **Email copy:** `docs/INSTANTLY_DETROIT_CAMPAIGN_COPY_2026-10-19_2300.md`

## How it flows

| Step | What happens | Where you see it |
|---|---|---|
| Find leads | The sales engine finds Detroit businesses (Google Places, job postings, Hunter) and the AI writes a 3-email sequence for each | Hub → Business leads |
| Promote | Those leads are added to **this campaign** with their emails as `{{subject_1}}`…`{{body_3}}` and a personal sign-up link `{{signup_url}}` | Instantly |
| Leads you upload in Instantly | Pulled into the CRM every weekday morning, or now with **Sync Instantly campaign** (source "instantly", status kept up to date from replies, clicks and Instantly's interest flag) | Hub → Business leads |
| Sent / clicked / bounced / unsubscribed | The webhook updates the lead's status. Unsubscribes go on the do-not-email list for good | Lead page → history |
| **Reply** | The **AI sales reply agent** reads it, sorts it (interested, question, referral, not now, not interested, unsubscribe, out of office), stops mail for no's and unsubscribes, and writes a draft answer | Hub alerts (sales) + the lead's history |
| Answer | A person checks the draft and sends it from Instantly's **Unibox**, then marks the lead in the Hub | Instantly + Hub |

The AI never sends anything on its own. It drafts, and a person sends.

## 1. Vercel environment variables (Production)

| Name | Value |
|---|---|
| `INSTANTLY_BIZ_CAMPAIGN_ID` | `3de836a0-4845-4350-80af-db9725831b43` |
| `INSTANTLY_API_KEY` 🔒 | Instantly → Settings → Integrations → API keys → **API v2** key (scopes that include leads and block lists; "all" is simplest) |
| `INSTANTLY_WEBHOOK_SECRET` 🔒 | any long random string you make up (30+ letters and numbers) |
| `BUSINESS_POSTAL_ADDRESS` | your business mailing address (required on cold email) |
| `ANTHROPIC_API_KEY` 🔒 | already set if the other AI agents work. The reply agent needs it |

Type the 🔒 values into Vercel yourself. Then **redeploy**.

## 2. Instantly webhook
In **Instantly → Settings → Integrations → Webhooks → Add webhook**:
- **URL:** `https://YOUR-SITE/api/webhooks/instantly?secret=THE-SAME-INSTANTLY_WEBHOOK_SECRET`
- **Campaign:** 1ST OUTREACH DETROIT (or all campaigns)
- **Events:** email sent, link clicked, reply received, lead unsubscribed, email bounced. Also "lead interested" / "not interested" if offered.

## 3. The campaign's email steps (important)
Pick one:
- **A. Let our AI write the emails (recommended).** Make the campaign's 3 steps exactly:
  - Step 1: subject `{{subject_1}}`, body `{{body_1}}`
  - Step 2: subject `{{subject_2}}`, body `{{body_2}}`
  - Step 3: subject `{{subject_3}}`, body `{{body_3}}`

  Every lead the engine adds gets its own personalized emails with a tracked sign-up link. Leads you upload by hand won't have those variables, so put them in a separate Instantly campaign with your own copy, or fill the variables in your CSV.
- **B. Keep your own copy in Instantly.** That works too: the sync and the reply agent still bring every lead and reply into the CRM. Leads the engine adds will get your copy instead of the AI-written one, so mention your website in the copy (there's no per-lead sign-up link).

## 4. Switch it on
1. Supabase → SQL Editor → run `supabase/setup/ADD_INSTANTLY_CRM_SYNC_2026-10-19_2230.sql` (once).
2. Hub → Business leads → **Sync Instantly campaign**. Every lead in the campaign shows up in the list.
3. Optional: in the same page, turn the engine on to keep adding new Detroit businesses. Start at 20 emails a day per warmed inbox.
4. Hub → Setup should show ✅ for "Instantly campaign → CRM (1ST OUTREACH DETROIT)".

## Rules it keeps
- **CAN-SPAM:** your postal address and an unsubscribe on every email (Instantly adds its own unsubscribe link).
- **Stops for good:** anyone who unsubscribes or says not interested is blocked in Instantly and never emailed again.
- **Separate domain:** send cold email from a separate, warmed-up domain, not info@handledsvc.com.
