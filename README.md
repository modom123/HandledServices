<!--
  FILE    : README.md
  PROJECT : Handled (myhumanai) — AI-run home & business services
  CREATED : 2026-10-01_1800 UTC
-->

# Handled — AI-run home & business services

A services company that delivers cleaning, lawn, trees, dog-waste removal, hauling, handyman work and
remodels through vetted subcontractors. AI runs it day to day, IEBC's AI workforce staffs it, and a small
human team manages it. Business plan: [`docs/BUSINESS_PLAN_2026-10-01_1830.md`](docs/BUSINESS_PLAN_2026-10-01_1830.md).

```
apps/web        Next.js 16 on Vercel — website, booking, customer portal, pro portal, Handled Hub, all APIs
apps/mobile     Expo (React Native) app — customer mode + pro mode
packages/core   Shared catalog, pricing engine, dispatch ranking, types (used by web + mobile)
supabase/       Postgres schema with row-level security, storage, realtime, seed data
scripts/        Seed generator (keeps the DB service list in sync with the pricing engine)
```

## What's in it

| Area | Where | Highlights |
|---|---|---|
| **Website** | `/`, `/services`, `/services/[slug]`, `/business`, `/pros` | SEO page per service, commercial-account and pro-recruiting funnels, AI concierge chat on every page |
| **Booking** | `/book` | Live upfront price, plan discounts, photos, optional AI review of notes/photos, card saved (charged after QA) |
| **Customer portal** | `/account` | Jobs, live timeline, completion photos, messages with the pro, reviews, recurring plans |
| **Pro portal** | `/pro` (+ mobile Pro mode) | Offers with payout (accept/pass), schedule, start → photos → complete, earnings |
| **Handled Hub** | `/hub` (staff only) | AI-driven-rate KPI, AI morning brief, alerts, jobs board, job control panel, pros & vetting, customers & B2B, finance & payouts, **IEBC Workforce**, AI assistant |
| **Invoice & Service Agreement** | `/invoice/[id]`, `/terms/service-agreement` | Every job's invoice carries the customer terms; accepted at booking (version, time and IP recorded); signed login-free link in every email; printable |
| **Pro Network & 1099** | `/hub/network`, `/hub/pros/[id]`, `/pro/onboarding`, `/pro/earnings` | Pros as the core asset: onboarding (W-9, contractor agreement, COI, license, background, payout), work & payout ledger, value generated, blended ratings, year-end 1099 worksheet |
| **IEBC Workforce API** | `/api/iebc/v1` | IEBC AI employees run departments with scoped permissions, autonomy levels, an approval queue and a usage meter |

### The AI layer (Claude, `apps/web/lib/ai/`)
| Feature | What it does | Guardrail |
|---|---|---|
| `quote.ts` | Reviews notes + photos, adjusts the rules-engine price, flags risks | Clamped to ±40% of the baseline, never below minimum |
| `dispatch.ts` | Re-ranks eligible pros (rating, load, job context), picks how many to offer | Can only choose from the insured, in-area, qualified shortlist |
| `qa.ts` | Checks completion photos against the booked scope | Anything doubtful goes to a human before charge/payout |
| `concierge.ts` | Customer chat with tools: real estimates, service questions, save lead | Quotes only numbers from the pricing engine |
| `ops-agent.ts` | Staff assistant over live data; can re-dispatch, change status, raise alerts | Staff-only; every action logged |
| `screen.ts` | First-pass screening of pro applications | Advisory; human approves; protected traits excluded |
| `brief.ts` | Daily ops brief (cron) | Read-only |

Every AI call is logged to `ai_runs` (tokens and cost show on the Finance page). Without `ANTHROPIC_API_KEY`,
everything still works on the deterministic engine. Refusal fallbacks are enabled (`fallbacks: "default"`).

### Money rules (enforced in code and in the database)
- **Paid upfront, always.** Customers pay the full price at booking (site visits are free; quoted work is paid on approval). Nothing is dispatched until it's paid.
- **Deposits** for big jobs (remodels, events, $1,000+): the deposit books the date and the pro; the balance is charged to the saved card before the start date, and the job can't start until it's paid in full.
- **Quick Charge** (`/hub/charges`): a Stripe pay link for any amount and description. There's no product catalog in Stripe; every checkout is built with the exact price.
- **Pros are paid after the job is finished** and passes QA, on the weekly payout run.
- **We keep 15–35% of every job**, payouts round down, and refunds or free extra services can never put a job below $0.
- **Making it right:** a free redo by the same pro, a complimentary service (capped at our take) or a refund (shared, or charged to the pro first when they were at fault).
- **Every job is rated twice:** by the customer, and by us (AI photo-QA draft, staff or IEBC). A pro's rating is 60% customer and 40% ours, and it drives dispatch.

### Job lifecycle
`requested → (site_visit → quoted) → paid → scheduled → dispatched → assigned → in_progress → qa_review → completed`

Booking → AI quote → auto-dispatch (offers expire after 2h; a 15-min cron re-dispatches) → first pro to accept wins
(race-safe) → pro starts → completion photos → AI QA → card charged, payout approved, review requested, next
recurring visit booked with the same pro.

## Going live

Follow **[`docs/GO_LIVE_CHECKLIST_2026-10-01_1941.md`](docs/GO_LIVE_CHECKLIST_2026-10-01_1941.md)** top to bottom. In short:

1. **Supabase:** new project → SQL Editor → paste `supabase/setup/HANDLED_SETUP_*.sql` → Run (every migration + the production catalog). Never run `supabase/demo_data.sql` on the live project.
2. **Vercel:** root directory `apps/web`, production branch `main`, environment variables from `apps/web/.env.example`.
3. **Stripe** webhook → `/api/stripe/webhook` (`checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`). **Resend** domain + SMTP for Supabase auth emails.
4. Sign in, make yourself admin, open **Handled Hub → Go-live setup** (`/hub/setup`) and fix every red/amber item.
5. **IEBC MasterHub → Team → Handled Ops:** enter the site URL + `IEBC_API_KEY`.
6. **Mobile:** `apps/mobile` → `eas init` → `eas build` → `eas submit`.
7. `node scripts/smoke-test.mjs https://YOUR-DOMAIN` → every line PASS. Point an uptime monitor at `/api/health`.

### Local development
```bash
npm install                      # root — installs web + core
cp apps/web/.env.example apps/web/.env.local
npm run dev                      # http://localhost:3000
npm test                         # pricing, dispatch, refunds, onboarding, calendar, event budget
npm run typecheck
node --experimental-strip-types scripts/gen-seed.ts          # regenerate seed.sql + demo_data.sql
node --experimental-strip-types scripts/build-setup-sql.ts   # regenerate the one-paste setup file
```

## IEBC Workforce integration

The Handled Hub (`/hub`) is this company's own command center, separate from the IEBC MasterHub. IEBC's AI
employees work *inside* it through a gated API:

```
GET  /api/iebc/v1                    → the agent's assignment + the actions it may use (JSON Schema params)
POST /api/iebc/v1  { action, params, reason }
     → 200 executed | 202 pending_approval | 403 denied | 422 failed
Headers: Authorization: Bearer $IEBC_API_KEY
         X-IEBC-Agent: arthur          (the employee id from the MasterHub workforce roster)
```

| Scope | Actions | Default agent(s) |
|---|---|---|
| `read` | `read.kpis`, `read.jobs`, `read.job`, `read.pros`, `read.alerts`, `read.applications`, `read.reviews`, `read.lapsed_customers` | all |
| `ops` | `ops.dispatch_job`, `ops.set_job_status`*, `ops.add_job_note`, `ops.create_alert`, `ops.approve_qa`† | Arthur Vance (autonomous), Katerina Rostova |
| `finance` | `finance.payout_queue`, `finance.set_job_price`†, `finance.mark_payout_paid`† | Eleanor Wei |
| `recruiting` | `recruiting.decide_application`†, `recruiting.activate_pro`†, `recruiting.flag_expiring_insurance` | Tyler Walsh, Marcus Hill |
| `retention` | `retention.message_customer`, `retention.email_customer`† | Diego Martinez (autonomous) |
| `sales` | `sales.list_accounts`, `sales.create_lead`, `sales.update_account` | Elena Markov, Clara Dubois (autonomous) |

† high-risk: always waits for human approval. \* cancelling a job is high-risk.
Autonomy: `suggest` / `approval` → every write is queued. `autonomous` → low-risk writes run immediately.
Change assignments, autonomy or pause an agent in **Handled Hub → IEBC Workforce**. That page also has the
monthly usage meter used for IEBC invoicing.

Example:
```bash
curl -X POST https://YOUR-DOMAIN/api/iebc/v1 \
  -H "Authorization: Bearer $IEBC_API_KEY" -H "X-IEBC-Agent: arthur" -H "Content-Type: application/json" \
  -d '{"action":"read.jobs","params":{"unassigned_only":true}}'
```

**Security:** if the MasterHub calls the API from the browser, set `IEBC_ALLOWED_ORIGIN` to its origin, rotate the
key regularly and keep high-risk scopes on approval. A small server-side relay that holds the key is better still.

## Conventions
Every source file starts with a FILE / PROJECT / CREATED header. Documents carry a timestamp in their file name
(`NAME_YYYY-MM-DD_HHMM.ext`). Code files keep framework-required names (Next.js routes such as `page.tsx`, and
Supabase's timestamped migrations), and JSON files that can't hold comments carry the stamp in a field.
