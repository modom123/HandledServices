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
apps/web        Next.js 16 on Vercel — website, booking, customer portal, pro portal, Command Center, all APIs
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
| **Command Center** | `/hub` (staff only) | AI-driven-rate KPI, AI morning brief, alerts, jobs board, job control panel, pros & vetting, customers & B2B, finance & payouts, **IEBC Workforce**, AI assistant |
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

### Job lifecycle
`requested → (site_visit → quoted) → scheduled → dispatched → assigned → in_progress → qa_review → completed`

Booking → AI quote → auto-dispatch (offers expire after 2h; a 15-min cron re-dispatches) → first pro to accept wins
(race-safe) → pro starts → completion photos → AI QA → card charged, payout approved, review requested, next
recurring visit booked with the same pro.

## Setup

### 1. Supabase
1. Create a project at supabase.com.
2. Run the migrations in order (SQL editor, or `supabase db push`):
   `supabase/migrations/20261001172300_init.sql`, then `20261001180000_iebc_workforce.sql`.
3. Optional demo data: run `supabase/seed.sql` (regenerate with `node --experimental-strip-types scripts/gen-seed.ts > supabase/seed.sql`).
4. Auth → URL configuration: add `https://YOUR-DOMAIN/auth/callback`. Enable email OTP.
5. Make yourself staff: sign in once, then
   `update profiles set role = 'admin' where email = 'you@company.com';`

### 2. Vercel (web)
1. Import the repo. **Root directory: `apps/web`** (the npm workspace installs `packages/core` automatically).
2. Set environment variables from `apps/web/.env.example`.
3. Crons in `apps/web/vercel.json`: the daily brief (12:00 UTC) and a 15-minute sweep. The sweep needs Vercel Pro; on the Hobby plan change its schedule to once a day (e.g. `0 13 * * *`). Vercel rejects unknown fields in `vercel.json`, so that file carries no timestamp header.
4. Stripe (optional): add a webhook to `/api/stripe/webhook` for `checkout.session.completed`.

### 3. Mobile (Expo)
```bash
cd apps/mobile && npm install
cp .env.example .env    # point EXPO_PUBLIC_API_URL at your Vercel URL
npx expo start          # Expo Go, or `eas build` for the stores
```

### 4. Local development
```bash
npm install                      # root — installs web + core
cp apps/web/.env.example apps/web/.env.local
npm run dev                      # http://localhost:3000
npm test                         # pricing + dispatch unit tests
npm run typecheck
```

## IEBC Workforce integration

The Command Center (`/hub`) is this company's own command center, separate from the IEBC MasterHub. IEBC's AI
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
Change assignments, autonomy or pause an agent in **Command Center → IEBC Workforce**. That page also has the
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
