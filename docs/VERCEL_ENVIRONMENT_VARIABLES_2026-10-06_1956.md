<!--
  FILE    : docs/VERCEL_ENVIRONMENT_VARIABLES_2026-10-06_1956.md
  PROJECT : Handled (HandledServices)
  CREATED : 2026-10-06_1956 UTC
  UPDATED : 2026-10-06_2010 UTC — GOOGLE_MAPS_API_KEY (exact job-to-pro distances).
  UPDATED : 2026-10-06_2230 UTC — XERO_CLIENT_ID / XERO_CLIENT_SECRET (Xero accounting).
  PURPOSE : Every environment variable the website reads, grouped by what it turns on, with where to get each value.
            Vercel → your project → Settings → Environment Variables → add each one for Production (and Preview).
            Secrets are never written in this file — type them straight into Vercel.
-->

# Vercel environment variables — Handled

Vercel → project **myhumanai-web** (the Vercel project keeps its old name after the GitHub repo rename to HandledServices — that is fine) → **Settings → Environment Variables**. Add each one for **Production** (and **Preview** if you use preview links), then **Redeploy**.

🔒 = secret (only in Vercel, never in chat, email or git) · 🌐 = public by design

## 1. Required to run the site

| Name | Value | Where it comes from |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` 🌐 | `https://handledsvc.com` (your live domain) | Every email/text link uses it |
| `NEXT_PUBLIC_SUPABASE_URL` 🌐 | `https://qpzkayrfcunzelnhcrff.supabase.co` | Built into the code already — optional |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` 🌐 | `sb_publishable_AoOckoK73PvM96_bMr0Obg_ZGZykQZ1` | Built into the code already — optional |
| `SUPABASE_SERVICE_ROLE_KEY` 🔒 | the **service_role** (or new `sb_secret_…`) key | Supabase → Project Settings → API. Rotate it first (it was pasted in chat) |
| `CRON_SECRET` 🔒 | any random 32+ characters | Make one up / password generator. **Also** add the same value in GitHub → repo → Settings → Secrets and variables → Actions → `CRON_SECRET` |
| `INVOICE_SIGNING_SECRET` 🔒 | any random 32+ characters (different from CRON_SECRET) | Make one up |
| `OWNER_EMAILS` | your email(s), comma-separated | Become Hub admin on first sign-in |
| `OPS_EMAIL` | where alerts and the morning brief go | e.g. ops@handledsvc.com |
| `EMAIL_FROM` | `Handled <hello@handledsvc.com>` | A sender on your domain |
| `NEXT_PUBLIC_SUPPORT_EMAIL` 🌐 | support@handledsvc.com | Shown on site and invoices |
| `NEXT_PUBLIC_SUPPORT_PHONE` 🌐 | (313) …-…… | Shown on site and invoices |
| `AUTO_DISPATCH` | `true` | Offers go to pros right after payment |
| `DISPATCH_CRON` | `github` | The 10-minute dispatch/backup cron runs on GitHub Actions |

GitHub (for the 10-minute cron): repo → Settings → Secrets and variables → Actions → **Secret** `CRON_SECRET` (same value) and **Variable** `HANDLED_URL` = your live site URL.

## 2. AI agents

| Name | Value | Where |
|---|---|---|
| `ANTHROPIC_API_KEY` 🔒 | `sk-ant-…` | console.anthropic.com → API Keys |

## 3. Payments (Stripe)

| Name | Value | Where |
|---|---|---|
| `STRIPE_SECRET_KEY` 🔒 | `sk_live_…` | Stripe → Developers → API keys |
| `STRIPE_PUBLISHABLE_KEY` 🌐 | `pk_live_…` | same page (Apple Pay / Google Pay in the app) |
| `XERO_CLIENT_ID` | from your Xero app | developer.xero.com → My Apps → New app (Web app), redirect `https://YOUR-DOMAIN/api/xero/callback` |
| `XERO_CLIENT_SECRET` 🔒 | from your Xero app | same page (Xero accounting — Hub → Accounting) |
| `STRIPE_WEBHOOK_SECRET` 🔒 | `whsec_…` | Stripe → Developers → Webhooks → endpoint `https://YOUR-DOMAIN/api/stripe/webhook` (include `checkout.session.completed`, `payment_intent.succeeded`, subscription events) |
| `STRIPE_TAX` | `on` or empty | Only if Stripe Tax is set up |

## 4. Messages to customers and pros

| Name | Value | Where |
|---|---|---|
| `TWILIO_ACCOUNT_SID` 🔒 | `AC…` | twilio.com → Console (texts: offers, backup calls, "on my way", customer updates) |
| `TWILIO_AUTH_TOKEN` 🔒 | | same |
| `TWILIO_MESSAGING_SERVICE_SID` | `MG…` (or use `TWILIO_FROM` = +1…) | Twilio → Messaging → Services (needs A2P 10DLC registration) |
| `RESEND_API_KEY` 🔒 | `re_…` | resend.com → API Keys (booking emails) |
| `SMTP_USER` | info@handledsvc.com | Company mailbox (Email Center) |
| `SMTP_PASSWORD` 🔒 | mailbox password | Hostinger |
| `SMTP_HOST` / `SMTP_PORT` / `IMAP_HOST` / `IMAP_PORT` | only if not Hostinger defaults | |
| `EXPO_ACCESS_TOKEN` 🔒 | | expo.dev → Access tokens (push notifications to the app) |
| `NEXT_PUBLIC_GOOGLE_REVIEW_URL` 🌐 | your Google review link | Google Business Profile → Ask for reviews |

## 5. Growth tools (optional)

| Name | Where |
|---|---|
| `GOOGLE_MAPS_API_KEY` 🔒 | Google Cloud → enable **Geocoding API** → API key. Exact distance from the customer's address to each pro's place of business (without it: ZIP centres) |
| `GOOGLE_PLACES_API_KEY` 🔒 | Google Cloud → APIs → Places API (pro + business lead finders) |
| `INSTANTLY_API_KEY` 🔒, `INSTANTLY_CAMPAIGN_ID`, `INSTANTLY_BIZ_CAMPAIGN_ID`, `INSTANTLY_WEBHOOK_SECRET` 🔒 | instantly.ai (outreach from a separate domain) |
| `BUSINESS_POSTAL_ADDRESS` | your mailing address (required in marketing emails) |
| `SAM_API_KEY` 🔒 | sam.gov → profile → Public API Key (government contracts) |
| `CHECKR_API_KEY` 🔒, `CHECKR_PACKAGE` | checkr.com (background checks) |
| `IEBC_API_KEY` 🔒, `IEBC_ALLOWED_ORIGIN` | IEBC MasterHub connection |

## Not set by you

`NODE_ENV`, `NEXT_RUNTIME`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_PLAN` — Vercel sets these.

## Mobile app (EAS build profile, not Vercel)

`EXPO_PUBLIC_API_URL` = your live site URL · `GOOGLE_MAPS_ANDROID_API_KEY` (Android map) · Supabase URL/key are built in.

After saving: **Deployments → … → Redeploy**, then open **Hub → Go-live setup** to see what's still missing.
