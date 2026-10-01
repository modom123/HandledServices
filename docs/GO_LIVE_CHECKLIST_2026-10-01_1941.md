<!--
  FILE    : docs/GO_LIVE_CHECKLIST_2026-10-01_1941.md
  PROJECT : Handled (myhumanai) — AI-run home & business services
  CREATED : 2026-10-01_1941 UTC
  PURPOSE : Exact steps to take Handled live: Supabase, Vercel, Stripe, email, AI, the
            Handled Hub, the IEBC MasterHub connection and the mobile apps. Work top to
            bottom; Hub → Go-live setup turns each item green as you finish it.
-->

# Handled — Go-Live Checklist

**What's already done in code:** website, booking calendar, payments, Handled Hub, pro portal, IEBC Workforce API, MasterHub "Handled Ops" page, mobile app, database setup file, smoke test.
**What only you can do:** create the accounts below and paste the keys. Each step says where.

---

## 0. Accounts you need

| Account | Cost | Why |
|---|---|---|
| Supabase | free → $25/mo | Database, logins, file storage |
| Vercel | have it (Hobby free / Pro $20/mo) | Website + Handled Hub hosting |
| Stripe | 2.9% + 30¢ per card payment | Upfront payments, refunds |
| Resend | free → $20/mo | Booking, payment and pro emails |
| Anthropic | pay as you go | AI quotes, dispatch, photo QA, chat, assistant |
| A domain (e.g. `gethandled.com`) | ~$15/yr | Your web address + email sending |
| Apple Developer | $99/yr | iPhone app |
| Google Play Console | $25 once | Android app |

---

## 1. Supabase (database) — 15 minutes

1. supabase.com → **New project** → region **US East** → save the database password somewhere safe.
2. **SQL Editor → New query** → open `supabase/setup/HANDLED_SETUP_*.sql` from the repo → paste the whole file → **Run**. (Creates every table, security rule, storage bucket, the 34 services and your launch market. Run it once, on a new project.)
3. **Do NOT run** `supabase/demo_data.sql` on this project; it's fake people for testing only.
4. **Authentication → URL Configuration**
   - Site URL: `https://YOUR-DOMAIN`
   - Redirect URLs: `https://YOUR-DOMAIN/auth/callback` and `handled://`
5. **Authentication → Emails → Templates → Magic Link**: add the 6-digit code so the mobile app can sign in:
   `<p>Your Handled sign-in code: <b>{{ .Token }}</b></p><p>Or click: <a href="{{ .ConfirmationURL }}">Sign in</a></p>`
6. **Authentication → Emails → SMTP Settings**: turn on custom SMTP with your Resend SMTP details (step 4). Supabase's built-in sender only allows a few emails per hour.
7. **Project Settings → API**: copy the **Project URL**, the **anon/publishable key** and the **service_role key** for step 2.

## 2. Vercel (website + Handled Hub) — 10 minutes

Project `myhumanai-web` → **Settings**:

- **Build and Deployment → Root Directory** = `apps/web`
- **Git → Production Branch** = `main`
- **Domains** → add `YOUR-DOMAIN` (and `www.`) → follow the DNS instructions
- **Environment Variables** (Production + Preview):

| Name | Value / where to get it | Needed |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://YOUR-DOMAIN` | ✅ |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → API → Project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API → anon / publishable key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API → service_role (secret) | ✅ |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | your real support email | ✅ |
| `NEXT_PUBLIC_SUPPORT_PHONE` | your real support phone | ✅ |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API keys | ✅ |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys (start with `sk_test_`) | ✅ |
| `STRIPE_WEBHOOK_SECRET` | step 3 | ✅ |
| `RESEND_API_KEY` | Resend → API keys | ✅ |
| `EMAIL_FROM` | `Handled <hello@YOUR-DOMAIN>` | ✅ |
| `OPS_EMAIL` | the inbox that gets alerts, applications and the daily brief | ✅ |
| `CRON_SECRET` | any long random string | ✅ |
| `INVOICE_SIGNING_SECRET` | any long random string | ✅ |
| `IEBC_API_KEY` | `openssl rand -hex 32` (same key goes in the MasterHub) | ✅ |
| `IEBC_ALLOWED_ORIGIN` | the MasterHub's web address once it's hosted | later |
| `AUTO_DISPATCH` | `true` | default |
| `EXPO_ACCESS_TOKEN` | expo.dev → Account → Access tokens (signs push notifications) | recommended |

Then **Deployments → ⋯ → Redeploy** so the new variables take effect.

## 3. Stripe (payments) — 20 minutes

1. Finish **account activation** (business details, bank account for payouts).
2. **Developers → Webhooks → Add endpoint** → `https://YOUR-DOMAIN/api/stripe/webhook` → events **`checkout.session.completed`**, **`checkout.session.async_payment_succeeded`** and **`checkout.session.async_payment_failed`** → copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
   - **Settings → Payment methods**: turn on Cards, Apple Pay, Google Pay and Link. ACH bank debit is optional; it's good for large remodel and event deposits.
   - **Connect → Get started → Express** (platform profile: marketplace). This turns on instant pay for pros; they connect from **Earnings → Set up instant pay**.
   - You do **not** need to create products or prices in Stripe. Every checkout is built on the fly with the exact amount (the booking price, a deposit, a balance or a Quick Charge).
2b. **Taking payments without a booking:** Handled Hub → **💳 Quick Charge**. Type an amount and what it's for (and the job ref, if any) → a Stripe pay link is created and emailed to the customer. Use it for change orders, custom quotes, event deposits and anything else with a one-off price.
3. Test in **test mode** first: book a job on your site and pay with card `4242 4242 4242 4242`. The job should flip to *Paid* and get dispatched.
4. When you're ready for real money, switch both keys to **live** (`sk_live_…` and the live webhook secret) and redeploy.

## 4. Email (Resend) — 15 minutes

1. Resend → **Domains → Add** `YOUR-DOMAIN` → add the DNS records it shows → wait for *Verified*.
2. Create an API key → `RESEND_API_KEY`. Use the same domain in `EMAIL_FROM`.
3. Resend → **SMTP** details → paste into Supabase SMTP settings (step 1.6).

## 5. Make yourself the admin — 2 minutes

1. Go to `https://YOUR-DOMAIN/login` and sign in with your email.
2. Supabase → SQL Editor: `update public.profiles set role = 'admin' where email = 'YOU@YOURCOMPANY.COM';`
3. Open `https://YOUR-DOMAIN/hub/setup` (**Handled Hub → Go-live setup**). Fix anything red, then amber, until it says **Ready to launch**.

## 6. Connect the IEBC MasterHub — 5 minutes

1. Open the IEBC MasterHub → **Team → Handled Ops**.
2. Enter `https://YOUR-DOMAIN` and the same `IEBC_API_KEY` → **Save & connect**.
3. You should see *Connected · 9 employees assigned*, live numbers, and the Handled portfolio card switches to **Live**.
4. In **Handled Hub → IEBC Workforce**, set each employee's autonomy. Start everyone on *Act with approval* for the first two weeks.
5. When the MasterHub is hosted on a web address, set `IEBC_ALLOWED_ORIGIN` to that address in Vercel.

## 7. Mobile apps — 1–2 days (store review)

```bash
cd apps/mobile
cp .env.example .env          # EXPO_PUBLIC_API_URL=https://YOUR-DOMAIN, Supabase URL + anon key, support email/phone
npm install
npx eas login                 # create a free Expo account
npx eas init                  # links the project (fills projectId)
npx eas build -p android --profile preview   # installable test APK for your phone
npx eas build -p all --profile production
npx eas submit -p ios         # App Store Connect
npx eas submit -p android     # Google Play
```

**Push notifications (job offers for pros, "job covered" for customers):**
- iPhone: `eas build` sets up the Apple push key for you — answer **Yes** when it asks to generate one.
- Android: create a free Firebase project → add an Android app with package `com.handled.app` → download `google-services.json` into `apps/mobile/` → add `"googleServicesFile": "./google-services.json"` under `android` in `app.json` → `npx eas credentials` → Android → upload the FCM V1 service-account key.
- Test: sign in on a phone as a pro, dispatch a job to that pro from the Hub — the phone should ring with "New job · $…".

For the store listings: privacy policy URL `https://YOUR-DOMAIN/privacy`, support URL `https://YOUR-DOMAIN`, category *Lifestyle* / *House & Home*. In `apps/mobile/app.json`, replace `YOUR-DOMAIN` in `extra`.

## 8. Business & legal (before the first paid job)

- [ ] LLC + EIN; business bank account (linked to Stripe)
- [ ] General liability + umbrella insurance for Handled itself
- [ ] Lawyer review: **Service Agreement** (`apps/web/lib/service-agreement.ts`), **Independent Contractor Agreement** (`apps/web/lib/agreement.ts`), Privacy Policy (`/privacy`)
- [ ] Sales tax: ask your accountant which services are taxable in Michigan; add tax lines before launching in new states
- [ ] Trademark search for the name "Handled" (rename in `packages/core/src/brand.ts` if needed)
- [ ] Background-check provider account (e.g. Checkr) for pro screening
- [ ] Accountant set up for 1099s (Handled Hub → Pro Network → Download 1099 worksheet)

## 9. Pros, then a dress rehearsal

0. Open **Hub → 🏅 Pro Program** and set who qualifies for each benefit, plus your insurance partner (name, link, phone, referral code). The guaranteed minimum starts off.
0. Read **`docs/PRO_OFFERING_2026-10-01_2110.md`**: the recruiting playbook, the insurance and license rules by trade, and 6 open decisions on pro pay policy. Have your insurance broker confirm the coverage minimums.
1. Share `https://YOUR-DOMAIN/pros`. Approve applicants in **Hub → Hiring & pros**. Each pro finishes **Setup & documents** (W-9, agreement, specialties, insurance plus any coverage their trade needs, license, background check, payout). Then you verify the documents and **Activate** them.
2. Aim for 2+ active pros per trade you'll advertise (the Go-live page lists trades with none).
3. Run **10 real jobs end to end** with friends and family: book → pay → offer → pro accepts → start → photos → AI QA → completed → pro payout approved → review. Fix anything odd before advertising.

## 10. Launch day

```bash
node scripts/smoke-test.mjs https://YOUR-DOMAIN     # every line should say PASS
```

- Point an uptime monitor (e.g. UptimeRobot, free) at `https://YOUR-DOMAIN/api/health`
- Turn on Google Business Profile, then Local Services Ads for junk removal and cleaning
- Watch **Hub → Dashboard** (AI-driven rate, alerts) and the 8 am daily brief email
