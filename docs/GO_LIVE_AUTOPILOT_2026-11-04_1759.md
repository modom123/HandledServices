<!--
  FILE    : docs/GO_LIVE_AUTOPILOT_2026-11-04_1759.md
  PROJECT : Handled (HandledServices) — AI-run home & business services
  CREATED : 2026-11-04_1759 UTC
  PURPOSE : How the Go-live autopilot (Mastermind → Go-live setup) takes over the checklist's manual entries.
-->
# Go-live autopilot

Mastermind → **Go-live setup** now has an **autopilot** card at the top. It previews what it can fix, and one
button makes the changes through each provider's API. Code: `apps/web/lib/golive-autopilot.ts`.

## One-time setup (the last values you paste by hand)

| Vercel variable | Where to get it | Unlocks |
|---|---|---|
| `VERCEL_TOKEN` | vercel.com → Account Settings → Tokens → Create (scope: the team that owns the project) | saving settings + redeploying |
| `VERCEL_PROJECT_ID` | Project → Settings → General → Project ID | same |
| `VERCEL_TEAM_ID` | Team Settings → General → Team ID (only for a team project) | same |
| `SUPABASE_ACCESS_TOKEN` | supabase.com/dashboard/account/tokens → Generate new token | running missing migrations |

Redeploy once, open Go-live setup and press **Run autopilot**.

## What it does for you

| Item | How |
|---|---|
| `CRON_SECRET`, `INVOICE_SIGNING_SECRET`, `LEAD_INTAKE_SECRET`, `GOLIVE_API_KEY`, `IEBC_API_KEY` | generates random values and saves them in Vercel |
| `NEXT_PUBLIC_SITE_URL` | set from the Vercel production domain |
| Stripe webhook | creates `/api/stripe/webhook` with every event the app needs (or adds missing events) and saves the signing secret as `STRIPE_WEBHOOK_SECRET` |
| Stripe billing portal | creates it (update card, invoices, cancel Handled Plus at period end) |
| Twilio incoming texts | points your number / Messaging Service at `/api/webhooks/twilio` |
| Database migrations | runs every missing one, oldest first, and stops at the first error |
| Service catalog | re-syncs it |
| Redeploy | one production redeploy when any setting changed |

### Business & legal items it ticks itself (on every visit)

- **Stripe account activated** — ticked when Stripe is live, cards and payouts are on and Connect works.
- **1099-NEC process** — ticked when `STRIPE_1099=on`.
- **Company formed / EIN / bank** — gets a note when Stripe shows a company with an EIN and a bank account; you confirm the Michigan registration.
- **TCPA / A2P 10DLC** — gets a note with Twilio's brand and campaign status; you tick it after an attorney reviews the consent wording.

Ticks it made are signed "Autopilot", and it removes them if the proof goes away. It never changes a tick or note a person made.

## Still by hand

- API keys only you can copy from a provider: Stripe secret and publishable keys, Twilio, Anthropic, Resend, Google and so on.
- The GitHub Actions `CRON_SECRET` secret, if dispatch runs on GitHub Actions. Copy the value from Vercel.
- Insurance, attorney reviews, trademark and licences: no API can confirm these. An agent, Zapier or a script can tick them:

```bash
curl -X POST https://YOUR-DOMAIN/api/hub/checklist \
  -H "Authorization: Bearer $GOLIVE_API_KEY" -H "Content-Type: application/json" \
  -d '{"by":"IEBC agent","items":[{"key":"ins_gl","done":true,"note":"Policy GL-123, Hiscox, bound 2026-11-04"}]}'
```

- `GET /api/hub/checklist`: every item with its state.
- `GET /api/hub/setup`: the full readiness report plus the checklist.
- `POST /api/hub/setup {"action":"autopilot","dry_run":true}`: preview. Leave out `dry_run` to make the changes.
