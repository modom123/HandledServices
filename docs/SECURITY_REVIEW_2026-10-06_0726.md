<!--
  FILE    : docs/SECURITY_REVIEW_2026-10-06_0726.md
  PROJECT : Handled (HandledServices) — AI-run home & business services
  CREATED : 2026-10-06_0726 UTC
  PURPOSE : Security review of the website, Hub, mobile app, API and database, with a focus on payments:
            what was checked, what was fixed, and the account settings only the owner can turn on.
-->

# Handled — Security Review (2026-10-06_0726 UTC)

## How card payments are protected (the short version)
- **Card numbers never touch Handled's servers or database.** Stripe Checkout and Stripe's in-app payment sheet
  collect them; we only ever see Stripe IDs. That keeps Handled in the lightest PCI category (SAQ A).
- **The server sets every price.** The app's price is a display only: the server recalculates it, and a quote the
  customer saw is signed (HMAC) and expires. "Name your price" is bounded on the server. A modified app cannot pay less.
- **Payments are only marked paid by Stripe.** The webhook verifies Stripe's signature; each payment flips
  pending → paid once (replays do nothing). In-app payments are settled exactly like Checkout.
- **The database enforces who sees what.** All 86 tables have row-level security; customers can read only their own
  jobs and payments and cannot write jobs, prices or payments at all. Nobody can make themselves staff (the role
  column can't be updated from the app; only an admin can add team members).

## Fixed in this review
| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | **High** | Scheduled jobs (`/api/cron/*`: dispatch, sweep, leads, daily brief, gov) accepted `Bearer undefined` when `CRON_SECRET` wasn't set — anyone could trigger them (emails, lead searches, dispatch). | `cronAuthorized()`: fails closed without a 16+ character secret, constant-time compare. Readiness check flags short/missing secrets. |
| 2 | **Medium** | Open redirect after sign-in: `?next=/\evil.com` passed the check (browsers read `\` as `/`), so a sign-in link could bounce someone to a phishing page. | `safeNext()` (core, tested with 10 bypass patterns) on the sign-in callback and login page. |
| 3 | Medium | Lead engines fetched any website URL (from Google or staff / CSV import) and followed redirects — could be pointed at internal or cloud-metadata addresses (SSRF). | `safeFetch()`: public http(s) hosts only, private/loopback/link-local/metadata and disguised IPs refused, every redirect hop re-checked. |
| 4 | Low | Bookings accepted any storage path as a photo. | Photo paths must match exactly what the upload endpoint creates (`isPhotoPath`), on booking, quote, snap and add-photos. |
| 5 | Low | Signing key fell back to a built-in default if two settings were missing. | No default in production — fails loudly instead. |
| 6 | Low | One elevated database function (`recompute_contractor_rating`) was callable from the app (harmless). | Migration `20261006072600_lock_down_rpc.sql`: server-only; gift-card balance function re-asserted server-only; new functions not callable anonymously by default. |
| 7 | Hardening | Mobile app kept the sign-in session and saved address in plain app storage. | Moved to the iOS Keychain / Android Keystore (`expo-secure-store`); existing sessions migrate without signing anyone out. |
| 8 | Hardening | No Content-Security-Policy header. | Added `frame-ancestors 'self'; object-src 'none'; base-uri 'self'; upgrade-insecure-requests` and Cross-Origin-Opener-Policy. Search-engine data on city pages is escaped. |

## Checked and found sound
- **All 112 API routes** have the right gate: Hub = staff (team changes = admin only), Pro = the pro's own records,
  Account = the customer's own jobs (ownership checked in every helper: pay, tip, reschedule, cancel, favorites,
  photos, requests, raise, track).
- **Webhooks:** Stripe (signature), Checkr (HMAC), Instantly (secret) — all constant-time and fail closed.
  IEBC Workforce API key: constant-time, fails closed, per-agent scopes, risky actions need human approval.
- **Sign-in:** every token is verified with Supabase on each request; passwordless email codes (Supabase rate-limits them).
- **Uploads:** images only, 8 MB max, server-generated names, private storage; documents staff-only.
- **Reviews** can't be faked onto another pro (the database sets the pro from the job; one review per job).
- **Rate limits** on booking, quotes, uploads, tips, payments, forms and error reports.
- **Headers:** HSTS (2 years), nosniff, frame protection, referrer policy, permissions policy.
- **No server secrets in browser code**; the website's dependencies have **0 known vulnerabilities**.

## Known, not fixed here
- **Mobile build tooling:** `npm audit` lists 26 issues (15 high) in Expo's build tools (Metro bundler, Expo CLI,
  code-signing library) — they run on the build machine, not in the app on people's phones. The fixes need the next
  Expo SDK; upgrade with `npx expo install expo@latest --fix` as its own tested change.
- **A full script Content-Security-Policy** needs per-request nonces in Next.js; worth doing before scale.

## Owner checklist (accounts only you control)
1. **Turn on two-factor authentication** on Stripe, Supabase, Vercel, GitHub, Expo/EAS, Apple Developer, Google Play
   and the domain registrar. These accounts *are* the system.
2. **Secrets:** `CRON_SECRET` = `openssl rand -hex 32` (same value in Vercel and the GitHub Action);
   `INVOICE_SIGNING_SECRET` = another random 32+ characters; never reuse the service role key elsewhere.
   Rotate any key that has ever been pasted into chat, email or a document.
3. **Supabase:** run migration `20261006072600_lock_down_rpc.sql`; Authentication → keep email OTP rate limits on;
   enable leaked-password protection; restrict who has dashboard access.
4. **Stripe:** keep Radar on (fraud rules); add the `payment_intent.succeeded` webhook event; restrict API keys to
   the team members who need them; turn on email alerts for disputes and payouts.
5. **Vercel:** set env vars only for the environments that need them (production secrets not in Preview unless needed);
   protect Preview deployments if they use live keys.
6. **Mobile release:** build v0.5.0+ (secure storage) and ask users to update.
