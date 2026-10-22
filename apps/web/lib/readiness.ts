/*
 * FILE    : apps/web/lib/readiness.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-01_1940 UTC
 * UPDATED : 2026-10-02_1329 UTC — text messages (Twilio), Stripe dispute/subscription webhook events,
 *           sales tax, Vercel Pro for the 10-minute dispatch cron, migrations 13–16.
 * UPDATED : 2026-10-02_2252 UTC — Google review link check; migration 19 (waitlist & Google reviews).
 * UPDATED : 2026-10-03_0027 UTC — migration 20 (seasonal reminders & quote follow-ups).
 * UPDATED : 2026-10-03_0124 UTC — migrations 21–23 (contract records, contract language, pro fairness).
 * UPDATED : 2026-10-03_0210 UTC — lead engine keys; migrations 24–25 (market pricing, pro lead engine).
 * UPDATED : 2026-10-03_0324 UTC — lead engine sends through Instantly.
 * UPDATED : 2026-10-06_0523 UTC — 10-minute dispatch runs on GitHub Actions; check passes with DISPATCH_CRON=github or VERCEL_PLAN=pro.
 * UPDATED : 2026-10-06_2315 UTC — Sign-in emails check (Handled sends its own code email when it can).
 * UPDATED : 2026-10-06_2230 UTC — Accounting (Xero): app keys, connection, checking account mapped; migration 52 (Xero accounting).
 * PURPOSE : Go-live readiness checks behind Hub → Setup: environment, database migrations,
 *           catalog sync, storage, Stripe, people and demo-data leaks. Reports presence and
 *           validity only — never secret values.
 * UPDATED : 2026-10-03_1418 UTC — checks migration 26 (crews & fast track) and flags catalog rows whose name or minimum is out of date.
 * UPDATED : 2026-10-04_1934 UTC — migration 27 (business accounts, launch sets, sales engine, photo ID) and the business sales engine key.
 * UPDATED : 2026-10-04_2204 UTC — migration 29 (open job board, customer favorites, crew member requests).
 * UPDATED : 2026-10-05_0130 UTC — migration 30 (job-posting leads for the business sales engine).
 * UPDATED : 2026-10-05_0148 UTC — company mailbox (Hostinger SMTP/IMAP) and migration 31 (Email Center).
 * UPDATED : 2026-10-05_0221 UTC — migration 32 (job checklists).
 * UPDATED : 2026-10-05_0246 UTC — migration 33 (pro screening interviews).
 * UPDATED : 2026-10-05_0418 UTC — migration 34 (pro rewards).
 * UPDATED : 2026-10-05_0434 UTC — OWNER_EMAILS check (first admin).
 * UPDATED : 2026-10-05_1441 UTC — SAM_API_KEY (government contracts).
 * UPDATED : 2026-10-06_0708 UTC — migration 45 (in-app payments) and the Stripe publishable key for Apple Pay / Google Pay in the app.
 * UPDATED : 2026-10-06_0726 UTC — CRON_SECRET must be 16+ characters (scheduled jobs fail closed otherwise).
 * UPDATED : 2026-10-07_1545 UTC — webhook event list includes payment_intent.succeeded (app payments) and the Stripe Identity events.
 * UPDATED : 2026-10-07_1610 UTC — webhook list adds charge.refunded.
 * UPDATED : 2026-10-07_1640 UTC — checks for bid measurements, Handled Points, service areas, mailing address and Google Maps.
 * UPDATED : 2026-10-07_2030 UTC — Adzuna (job-posting leads) check.
 * UPDATED : 2026-10-11_1625 UTC — Hunter.io lead-email check (HUNTER_API_KEY).
 * UPDATED : 2026-10-11_1603 UTC — carrier partner check (3 Lakes Logistics: added, vetting or approved).
 * UPDATED : 2026-10-11_2250 UTC — migration 59: saved checklists (RUN_ONCE_LATEST_2026-10-11_2250.sql covers 58 and 59).
 * UPDATED : 2026-10-12_0005 UTC — migrations 60–62: texts inbox, saved home profiles, pro calendar feed and ZIP codes (RUN_ONCE_LATEST_2026-10-12_0005.sql covers 56–62).
 * UPDATED : 2026-10-12_0138 UTC — Stripe checked live: account activation (charges / payouts / requirements), the webhook endpoint
 *           and its events, live/test keys matching, signing-secret format, pros ready for payouts, money for Monday's
 *           payouts, customer portal, 1099 tax forms.
 * UPDATED : 2026-10-12_0121 UTC — migration 63: ID numbers (RUN_ONCE_LATEST_2026-10-12_0121.sql covers 56–63).
 * UPDATED : 2026-10-12_1540 UTC — Twilio check names what's missing (Account SID AC…, Auth Token or API key SK…, number / Messaging Service).
 * UPDATED : 2026-10-12_1525 UTC — migration 64: Handled Talent flat fee per hire (RUN_ONCE_LATEST_2026-10-12_1525.sql covers 56–64).
 * UPDATED : 2026-10-11_2242 UTC — migration 58: notification log (ADD_NOTIFICATION_LOG_*.sql).
 * UPDATED : 2026-10-15_0300 UTC — migration 65: book now, pay after (ADD_BOOK_NOW_PAY_AFTER_2026-10-15_0300.sql).
 * UPDATED : 2026-10-18_0248 UTC — migration 65: pro resume & profile photo (ADD_PRO_RESUME_PHOTO_2026-10-18_0248.sql).
 * UPDATED : 2026-10-18_0415 UTC — migrations listed by file (failing ones name the file to run), 20 more probed; a Webhooks
 *           section (Stripe, Twilio, and new checks that Checkr results and Instantly events actually arrive).
 * UPDATED : 2026-10-18_1501 UTC — site URL loses its trailing slash (no more "//api/stripe/webhook" in fixes);
 *           with duplicate webhook endpoints, events are checked on the one at the exact site address and the
 *           duplicate warning names which endpoint(s) to delete.
 * UPDATED : 2026-10-21_0130 UTC — Instantly webhook secret optional: replies are pulled from the API without it.
 * UPDATED : 2026-10-21_0030 UTC — migrations from Oct 19–21 probed (one paste: RUN_ONCE_ALL_NEW_2026-10-21_0000.sql).
 * UPDATED : 2026-10-20_0100 UTC — omnichannel checks: lead intake, Meta / Google lead forms, conversion tracking, social posting.
 */
import "server-only";
import { BRAND, BRAND_PLACEHOLDERS, SERVICES, STRIPE_WEBHOOK_EVENTS, TRADES, keyMode, keysMatch, missingWebhookEvents } from "@handled/core";
import { adminClient } from "./supabase/server";
import { supabaseConfigured } from "./supabase/env";
import { connectReady, getStripe } from "./stripe";
import type Stripe from "stripe";
import { getConnection, xeroConfigured } from "./xero";
import { siteUrl as siteUrlNow } from "./notify";

export type Check = { group: string; label: string; status: "ok" | "warn" | "fail"; detail: string; fix?: string };

const has = (k: string) => Boolean(process.env[k]?.trim());

export async function readiness(): Promise<Check[]> {
  const c: Check[] = [];
  const add = (group: string, label: string, ok: boolean | "warn", detail: string, fix?: string) =>
    c.push({ group, label, status: ok === true ? "ok" : ok === "warn" ? "warn" : "fail", detail, fix: ok === true ? undefined : fix });

  // ── Environment
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  add("Website & Vercel", "Site URL", site.startsWith("https://") && !site.includes("localhost") ? true : false, site ? (site.includes("localhost") ? `${site} — email links would point to localhost; using ${siteUrlNow()} for now` : site) : `not set — using ${siteUrlNow()} for now`, "Vercel → Settings → Environment Variables → NEXT_PUBLIC_SITE_URL = https://your-domain (used in every email link)");
  add("Website & Vercel", "Support email & phone", !BRAND_PLACEHOLDERS, BRAND_PLACEHOLDERS ? "still the placeholder support@handled.example / (555)" : "set", "Set NEXT_PUBLIC_SUPPORT_EMAIL and NEXT_PUBLIC_SUPPORT_PHONE in Vercel (and EXPO_PUBLIC_… for the app)");
  add("Website & Vercel", "Google review link", BRAND.googleReviewUrl ? true : "warn", BRAND.googleReviewUrl || "not set — customers aren't asked to review us on Google", "Google Business Profile → Ask for reviews → copy the link → set NEXT_PUBLIC_GOOGLE_REVIEW_URL in Vercel and EXPO_PUBLIC_GOOGLE_REVIEW_URL for the app");
  add("Pro recruiting", "Lead engine: finding pros", has("GOOGLE_PLACES_API_KEY") ? true : "warn", has("GOOGLE_PLACES_API_KEY") ? "Google Places key set" : "not set — CSV import only", "Google Cloud → enable Places API (New) → create an API key (restrict it to Places API) → GOOGLE_PLACES_API_KEY in Vercel. Then turn the engine on in Hub → Pro leads");
  add("Business sales", "Government contracts (SAM.gov)", has("SAM_API_KEY") ? true : "warn", has("SAM_API_KEY") ? "SAM.gov key set" : "not set — no contract search", "SAM.gov → sign in → Workspace → your profile → Public API Key → SAM_API_KEY in Vercel. Then pick the work and switch on the daily search in Hub → Gov contracts. Register Handled as an entity in SAM.gov (free) to bid and to get ~1,000 calls a day");
  add("Pro recruiting", "Lead engine: invitations (Instantly)", has("INSTANTLY_API_KEY") && has("INSTANTLY_CAMPAIGN_ID") && has("BUSINESS_POSTAL_ADDRESS") ? true : "warn", !has("INSTANTLY_API_KEY") ? "not set — no invitation emails" : !has("INSTANTLY_CAMPAIGN_ID") ? "INSTANTLY_CAMPAIGN_ID missing" : !has("BUSINESS_POSTAL_ADDRESS") ? "BUSINESS_POSTAL_ADDRESS missing" : has("INSTANTLY_WEBHOOK_SECRET") ? "set (replies by webhook)" : "set (replies pulled from Instantly every 10 minutes — no webhook needed)", `Instantly: connect warmed-up inboxes on a separate domain, create the campaign (steps {{subject_1}}/{{body_1}} … see docs/LEAD_ENGINE_SETUP_*), API key (v2) → INSTANTLY_API_KEY, campaign id → INSTANTLY_CAMPAIGN_ID, webhook ${site || "https://your-domain"}/api/webhooks/instantly?secret=… → INSTANTLY_WEBHOOK_SECRET; plus BUSINESS_POSTAL_ADDRESS (CAN-SPAM)`);
  add("Business sales", "Lead emails (Hunter.io)", has("HUNTER_API_KEY") ? true : "warn", has("HUNTER_API_KEY") ? `set — when a lead's website shows no email, Hunter finds the owner (pros) or the facilities / office manager (businesses), up to ${Number(process.env.HUNTER_DAILY_LIMIT ?? 25) || 0} lookups a day` : "not set — leads without an email on their website go to the call list", "hunter.io → sign up → API → copy the key → HUNTER_API_KEY in Vercel (optional HUNTER_DAILY_LIMIT, default 25 = one credit each), then Redeploy");
  add("Business sales", "Job-posting leads (Adzuna)", has("ADZUNA_APP_ID") && has("ADZUNA_APP_KEY") ? true : "warn", has("ADZUNA_APP_ID") && has("ADZUNA_APP_KEY") ? "set — businesses in MI and WA hiring cleaners, janitors, porters and maintenance techs become leads each weekday" : "not set — job-posting leads are added by hand only", "Free key at developer.adzuna.com → ADZUNA_APP_ID and ADZUNA_APP_KEY in Vercel (GOOGLE_PLACES_API_KEY adds each company's website and phone)");
  add("Omnichannel", "Lead intake for Zapier / Make (TikTok, LinkedIn, Yelp, Google Local Services…)", (process.env.LEAD_INTAKE_SECRET?.length ?? 0) >= 16 ? true : "warn", (process.env.LEAD_INTAKE_SECRET?.length ?? 0) >= 16 ? "set" : "LEAD_INTAKE_SECRET missing (16+ characters) — automations can't send leads", `POST leads to ${site || "https://your-domain"}/api/leads/intake?key=<LEAD_INTAKE_SECRET>&channel=yelp (or tiktok_ads, linkedin, google_lsa…) — see docs/OMNICHANNEL_SETUP_*`);
  add("Omnichannel", "Facebook / Instagram Lead Ads → Lead inbox", has("META_APP_SECRET") && has("META_VERIFY_TOKEN") && has("META_PAGE_ACCESS_TOKEN") ? true : "warn", !has("META_PAGE_ACCESS_TOKEN") ? "META_PAGE_ACCESS_TOKEN missing" : !has("META_APP_SECRET") ? "META_APP_SECRET missing" : !has("META_VERIFY_TOKEN") ? "META_VERIFY_TOKEN missing" : "set", `Meta app → Webhooks → Page → leadgen → ${site || "https://your-domain"}/api/webhooks/meta-leads (verify token = META_VERIFY_TOKEN)`);
  add("Omnichannel", "Google Ads lead forms → Lead inbox", has("GOOGLE_LEAD_FORM_KEY") ? true : "warn", has("GOOGLE_LEAD_FORM_KEY") ? "set" : "GOOGLE_LEAD_FORM_KEY missing", `Google Ads → lead form → webhook ${site || "https://your-domain"}/api/webhooks/google-leads with key = GOOGLE_LEAD_FORM_KEY`);
  add("Omnichannel", "Ad conversion tracking", has("NEXT_PUBLIC_META_PIXEL_ID") || has("NEXT_PUBLIC_GOOGLE_ADS_ID") || has("NEXT_PUBLIC_TIKTOK_PIXEL_ID") ? true : "warn", [has("NEXT_PUBLIC_META_PIXEL_ID") && `Meta pixel${has("META_CAPI_TOKEN") ? " + Conversions API" : ""}`, has("NEXT_PUBLIC_GOOGLE_ADS_ID") && `Google Ads${has("NEXT_PUBLIC_GOOGLE_ADS_BOOKING_LABEL") ? " + booking conversion" : " (add NEXT_PUBLIC_GOOGLE_ADS_BOOKING_LABEL)"}`, has("NEXT_PUBLIC_TIKTOK_PIXEL_ID") && `TikTok pixel${has("TIKTOK_EVENTS_TOKEN") ? " + Events API" : ""}`].filter(Boolean).join(", ") || "no pixels set — ad platforms can't see bookings", "NEXT_PUBLIC_META_PIXEL_ID + META_CAPI_TOKEN, NEXT_PUBLIC_GOOGLE_ADS_ID + NEXT_PUBLIC_GOOGLE_ADS_BOOKING_LABEL (+ _LEAD_LABEL), NEXT_PUBLIC_TIKTOK_PIXEL_ID + TIKTOK_EVENTS_TOKEN, then Redeploy");
  add("Omnichannel", "Social posting (Facebook / Instagram)", has("META_PAGE_ID") && has("META_PAGE_ACCESS_TOKEN") ? true : "warn", has("META_PAGE_ID") && has("META_PAGE_ACCESS_TOKEN") ? `Facebook${has("META_IG_USER_ID") ? " + Instagram" : " (add META_IG_USER_ID for Instagram)"}` : "not connected — posts can be written and approved, not published", "META_PAGE_ID, META_PAGE_ACCESS_TOKEN (pages_manage_posts, instagram_content_publish), META_IG_USER_ID; TikTok videos are posted from the app");
  add("Business sales", "Instantly campaign → CRM (1ST OUTREACH DETROIT)", has("INSTANTLY_API_KEY") && has("INSTANTLY_BIZ_CAMPAIGN_ID") ? true : "warn", !has("INSTANTLY_API_KEY") ? "INSTANTLY_API_KEY missing — campaign leads can't sync" : !has("INSTANTLY_BIZ_CAMPAIGN_ID") ? "INSTANTLY_BIZ_CAMPAIGN_ID missing" : has("INSTANTLY_WEBHOOK_SECRET") ? "set (replies by webhook)" : "set — leads sync hourly and replies every 10 minutes from Instantly's API (no webhook or Hypergrowth plan needed)", `INSTANTLY_BIZ_CAMPAIGN_ID = the campaign id (1ST OUTREACH DETROIT: 3de836a0-4845-4350-80af-db9725831b43); Instantly → Settings → Webhooks → ${site || "https://your-domain"}/api/webhooks/instantly?secret=<INSTANTLY_WEBHOOK_SECRET> for that campaign (sent, clicked, replied, unsubscribed, bounced). Leads sync into Hub → Business leads daily or with "Sync Instantly campaign"`);
  add("Business sales", "Sales engine: business emails (Instantly)", has("INSTANTLY_API_KEY") && has("INSTANTLY_BIZ_CAMPAIGN_ID") && has("BUSINESS_POSTAL_ADDRESS") ? true : "warn", !has("INSTANTLY_BIZ_CAMPAIGN_ID") ? "INSTANTLY_BIZ_CAMPAIGN_ID not set — no business sales emails" : "set", "Create a second Instantly campaign (steps {{subject_1}}/{{body_1}} … 3) → INSTANTLY_BIZ_CAMPAIGN_ID; turn it on in Hub → Business leads");
  add("Website & Vercel", "Cron secret", (process.env.CRON_SECRET ?? "").length >= 16, (process.env.CRON_SECRET ?? "").length >= 16 ? "set" : has("CRON_SECRET") ? "too short — scheduled jobs refuse to run (use 32+ random characters)" : "missing — scheduled jobs (dispatch, sweep, brief) won't run", "Add CRON_SECRET (openssl rand -hex 32) in Vercel and the same value as the GitHub Actions secret");
  add("Website & Vercel", "Invoice link signing", has("INVOICE_SIGNING_SECRET") ? true : "warn", has("INVOICE_SIGNING_SECRET") ? "set" : "falling back to the service role key", "Add INVOICE_SIGNING_SECRET (long random string)");
  add("Supabase", "Project URL & public key", supabaseConfigured, supabaseConfigured ? "set" : "missing", "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from Supabase → Project Settings → API");
  add("Supabase", "Service role key", has("SUPABASE_SERVICE_ROLE_KEY"), has("SUPABASE_SERVICE_ROLE_KEY") ? "set" : "missing", "Add SUPABASE_SERVICE_ROLE_KEY (server only) from Supabase → Project Settings → API");
  add("AI (Claude)", "Anthropic API key", has("ANTHROPIC_API_KEY") ? true : "warn", has("ANTHROPIC_API_KEY") ? "set" : "missing — quotes/dispatch/QA fall back to rules, chat & assistant offline", "Add ANTHROPIC_API_KEY from console.anthropic.com");
  add("Email", "Resend", has("RESEND_API_KEY") && has("EMAIL_FROM") ? true : "warn", has("RESEND_API_KEY") ? `from ${process.env.EMAIL_FROM ?? "(EMAIL_FROM missing)"}` : has("SMTP_USER") && has("SMTP_PASSWORD") ? "not set — booking emails go from the company mailbox instead" : "missing — emails are only logged", "Add RESEND_API_KEY + EMAIL_FROM and verify your sending domain in Resend (or connect the company mailbox below)");
  add("Access", "Owner admin (OWNER_EMAILS)", has("OWNER_EMAILS") ? true : "warn", has("OWNER_EMAILS") ? "set" : "not set — make yourself admin by adding your email", "In Vercel set OWNER_EMAILS=you@handledsvc.com (comma-separated for more), sign in once and you're an admin; add other staff in Hub → Team");
  add("Site", "Business mailing address", has("BUSINESS_POSTAL_ADDRESS") ? true : "warn", has("BUSINESS_POSTAL_ADDRESS") ? "shown in the footer and on /contact" : "not set — the footer and /contact show no address (also required on marketing email)", "In Vercel set BUSINESS_POSTAL_ADDRESS=\"123 Main St, Detroit, MI 48201\" (a PO box or registered-agent address is fine)");
  add("Site", "Address lookup (Google Maps)", has("GOOGLE_MAPS_API_KEY") ? true : "warn", has("GOOGLE_MAPS_API_KEY") ? "set — pro distance uses exact addresses" : "not set — distances use ZIP centers (less precise dispatch)", "Google Cloud → enable the Geocoding API → API key → GOOGLE_MAPS_API_KEY in Vercel");
  add("Email", "Company mailbox (Email Center)", has("SMTP_USER") && has("SMTP_PASSWORD") && has("BUSINESS_POSTAL_ADDRESS") ? true : "warn", !has("SMTP_USER") || !has("SMTP_PASSWORD") ? "not connected — no marketing email or inbox" : !has("BUSINESS_POSTAL_ADDRESS") ? "BUSINESS_POSTAL_ADDRESS missing (required on marketing email)" : `connected: ${process.env.SMTP_USER}`, "In Vercel set SMTP_USER=info@handledsvc.com and SMTP_PASSWORD (the Hostinger mailbox password), then Hub → Email Center → Check mailbox & domain (SPF, DKIM, DMARC)");
  const signinMail = has("SUPABASE_SERVICE_ROLE_KEY") && (has("RESEND_API_KEY") || (has("SMTP_USER") && has("SMTP_PASSWORD")));
  add("Email", "Sign-in emails", signinMail ? true : "warn", signinMail ? "Handled sends the code + a link that works on any device" : "falling back to Supabase's email — links only work in the same browser, and the code shows only if the templates include it", "Set SUPABASE_SERVICE_ROLE_KEY and RESEND_API_KEY (or SMTP_USER + SMTP_PASSWORD) in Vercel; add https://YOUR-DOMAIN/auth/confirm to Supabase → Authentication → URL Configuration → Redirect URLs");
  add("Email", "Ops inbox", has("OPS_EMAIL") ? true : "warn", process.env.OPS_EMAIL ?? "missing", "Add OPS_EMAIL — receives critical alerts, new pro applications and the daily brief");
  {
    const acct = process.env.TWILIO_ACCOUNT_SID?.trim() ?? "";
    const auth = has("TWILIO_AUTH_TOKEN") || (has("TWILIO_API_KEY") && has("TWILIO_API_SECRET"));
    const sender = has("TWILIO_MESSAGING_SERVICE_SID") || has("TWILIO_FROM");
    const keyLooksWrong = has("TWILIO_API_KEY") && !process.env.TWILIO_API_KEY!.trim().startsWith("SK");
    const ok = acct.startsWith("AC") && auth && sender && !keyLooksWrong;
    const missing = [!acct ? "TWILIO_ACCOUNT_SID" : !acct.startsWith("AC") ? "TWILIO_ACCOUNT_SID must start with AC (the Account SID, not an API key)" : null,
      !auth ? "TWILIO_AUTH_TOKEN (or TWILIO_API_KEY + TWILIO_API_SECRET)" : null, keyLooksWrong ? "TWILIO_API_KEY must start with SK" : null,
      !sender ? "TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM" : null].filter(Boolean);
    add("Text messages", "Twilio SMS", ok ? true : "warn", ok ? `set${has("TWILIO_API_KEY") ? " (API key)" : ""}` : `missing: ${missing.join("; ")} — customers and pros get push + email only`,
      "Twilio Console → Account info: Account SID (AC…) into TWILIO_ACCOUNT_SID; Auth Token into TWILIO_AUTH_TOKEN (or an API key: SK… into TWILIO_API_KEY, its secret into TWILIO_API_SECRET); your number (+1…) into TWILIO_FROM or a Messaging Service SID (MG…) into TWILIO_MESSAGING_SERVICE_SID; register A2P 10DLC");
    if (ok && !has("TWILIO_AUTH_TOKEN")) add("Text messages", "Incoming texts verified", "warn", "TWILIO_AUTH_TOKEN not set — texts sent to your number are refused (Twilio signs them with the Auth Token, not the API key)", "Twilio Console → Account info → Auth Token: copy it into TWILIO_AUTH_TOKEN");
  }
  const dispatchCron = process.env.DISPATCH_CRON === "github" ? "GitHub Actions" : process.env.VERCEL_PLAN === "pro" ? "Vercel Pro" : "";
  add("Website & Vercel", "10-minute dispatch cron", dispatchCron ? true : "warn", dispatchCron || "not confirmed — without it, unanswered offers wait for the daily sweep", "In GitHub → Settings → Secrets and variables → Actions, add secret CRON_SECRET (same as Vercel) and variable HANDLED_URL, then set DISPATCH_CRON=github in Vercel");
  add("Mobile app", "Apple Pay / Google Pay in the app", has("STRIPE_PUBLISHABLE_KEY") || has("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY") ? true : "warn", has("STRIPE_PUBLISHABLE_KEY") || has("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY") ? "publishable key set" : "missing — the app falls back to the Stripe Checkout page", "Stripe → Developers → API keys → copy the publishable key into STRIPE_PUBLISHABLE_KEY; add the payment_intent.succeeded event to the webhook")
  add("Mobile app", "Push notifications", has("EXPO_ACCESS_TOKEN") ? true : "warn", has("EXPO_ACCESS_TOKEN") ? "Expo access token set" : "works without it; add EXPO_ACCESS_TOKEN for signed push requests", "expo.dev → Account → Access tokens → create → add EXPO_ACCESS_TOKEN in Vercel");
  add("IEBC workforce", "IEBC API key", has("IEBC_API_KEY") ? true : "warn", has("IEBC_API_KEY") ? "set" : "missing — IEBC agents can't connect", "Add IEBC_API_KEY (openssl rand -hex 32) and paste the same key in IEBC MasterHub → Handled Ops");
  add("IEBC workforce", "Allowed origin", has("IEBC_ALLOWED_ORIGIN") ? true : "warn", process.env.IEBC_ALLOWED_ORIGIN ?? "* (any website may call with the key)", "Set IEBC_ALLOWED_ORIGIN to the MasterHub's web address");

  // ── Accounting (Xero is the books; Stripe activity is pushed daily)
  const xeroConn = supabaseConfigured && has("SUPABASE_SERVICE_ROLE_KEY") ? await getConnection().catch(() => null) : null;
  add("Accounting (Xero)", "Xero app keys", xeroConfigured() ? true : "warn", xeroConfigured() ? "set" : "missing — nothing reaches your books automatically", `developer.xero.com → My Apps → New app (Web app), redirect URI ${site || "https://your-domain"}/api/xero/callback; set XERO_CLIENT_ID and XERO_CLIENT_SECRET`);
  if (xeroConfigured()) {
    add("Accounting (Xero)", "Xero connected", xeroConn?.tenant_id ? true : "warn", xeroConn?.tenant_id ? `${xeroConn.tenant_name}` : "not connected", "Hub → Accounting (Xero) → Connect Xero (admin)");
    if (xeroConn?.tenant_id) add("Accounting (Xero)", "Checking account mapped", xeroConn.settings.accounts?.checking_bank ? true : "warn", xeroConn.settings.accounts?.checking_bank ? `code ${xeroConn.settings.accounts.checking_bank}` : "missing — Stripe payouts to the bank can't be recorded", "Hub → Accounting (Xero) → Account mapping → Business checking: enter the code of your bank account in Xero, then Create missing accounts");
  }

  // ── Stripe
  const stripe = getStripe();
  if (!stripe) add("Payments (Stripe)", "Stripe keys", "warn", "not set — staff must take payment by phone and click Mark paid", "Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET");
  else {
    try {
      const bal = await stripe.balance.retrieve(); // cheap call that proves the key works
      add("Payments (Stripe)", "Stripe account", bal.livemode ? true : "warn", bal.livemode ? "LIVE mode — real cards are charged" : "TEST mode — no real money moves", "Switch to sk_live_ keys after finishing Stripe account activation");
    } catch (e) {
      add("Payments (Stripe)", "Stripe account", false, `key rejected: ${e instanceof Error ? e.message : e}`, "Re-copy STRIPE_SECRET_KEY");
    }
    add("Webhooks", "Stripe: signing secret", has("STRIPE_WEBHOOK_SECRET"), has("STRIPE_WEBHOOK_SECRET") ? "set" : "missing — paid bookings won't dispatch", `Stripe → Developers → Webhooks → endpoint ${site || "https://your-domain"}/api/stripe/webhook, events checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, payment_intent.succeeded (app payments), charge.refunded (refunds made in Stripe), charge.dispute.created, charge.dispute.updated, charge.dispute.closed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted, identity.verification_session.verified and identity.verification_session.requires_input (pro ID checks); copy the signing secret`);
    add("Payments (Stripe)", "Sales tax", process.env.STRIPE_TAX === "on" ? true : "warn", process.env.STRIPE_TAX === "on" ? "Stripe Tax on — tax added where the service is taxable" : "off — fine in Michigan for most services; turn on before adding states that tax services", "Stripe → Tax → add your registrations, then set STRIPE_TAX=on");
    await stripeAccountChecks(stripe, add, site || siteUrlNow());
  }
  // ── Pro recruiting (background checks)
  add("Pro recruiting", "Background checks (Checkr)", has("CHECKR_API_KEY") && has("CHECKR_PACKAGE") ? true : "warn",
    has("CHECKR_API_KEY") ? (has("CHECKR_PACKAGE") ? "automated — ordered as soon as a pro's W-9 and agreement are in" : "CHECKR_PACKAGE missing") : "manual — ops gets a task to order each check",
    `Checkr → Account settings → API keys: set CHECKR_API_KEY and CHECKR_PACKAGE (your package slug); add the webhook ${site || "https://your-domain"}/api/checkr/webhook (report.completed, report.suspended, report.canceled, invitation.completed)`);

  if (!supabaseConfigured || !has("SUPABASE_SERVICE_ROLE_KEY")) return c;
  const db = adminClient();

  // ── Database migrations: probe one table/column each adds; a failing one names the file to run.
  // (Migrations that only change constraints or data — retire grocery, lead segments, customer notes, locked-down RPC,
  // cancellation tracking, pricing uplift, cargo coverage, service areas — can't be probed this way.)
  const M = "Database migrations";
  const probes: [string, string, () => PromiseLike<{ error: { message: string } | null }>][] = [
    ["20261001172300_init", "jobs, pros, security rules", () => db.from("jobs").select("id").limit(1)],
    ["20261001180000_iebc_workforce", "IEBC workforce", () => db.from("iebc_agents").select("id").limit(1)],
    ["20261001183000_take_rate_guard", "take-rate guard", () => db.from("payouts").select("id").limit(1)],
    ["20261001190000_upfront_payment", "upfront payment", () => db.from("jobs").select("paid_at, amount_paid, remedy").limit(1)],
    ["20261001200000_contractor_workforce", "contractor workforce & ratings", () => db.from("ops_ratings").select("id").limit(1)],
    ["20261001203000_service_agreement", "service agreement", () => db.from("jobs").select("terms_version").limit(1)],
    ["20261001204300_offers_push_notifications", "offers & push notifications", () => db.from("push_tokens").select("id").limit(1)],
    ["20261001205300_deposits_quick_charge", "deposits & Quick Charge", () => db.from("jobs").select("payment_plan, deposit_paid_at").limit(1)],
    ["20261001210900_pro_vetting", "pro vetting", () => db.from("contractors").select("specialties, coverage").limit(1)],
    ["20261001212400_pro_benefits", "pro benefits", () => db.from("pro_program_settings").select("id").limit(1)],
    ["20261001233400_dispatch_geo_availability", "dispatch geo & availability", () => db.from("zip_geo").select("zip").limit(1)],
    ["20261002000600_pro_recruiting", "pro recruiting", () => db.from("recruiting_events").select("id").limit(1)],
    ["20261002023316_pro_promises", "pro promises", () => db.from("contractors").select("referral_bonus_paid_at").limit(1)],
    ["20261002025553_pro_roster", "pro roster (on call, location)", () => db.from("contractors").select("on_call_until, last_located_at").limit(1)],
    ["20261002030209_customer_timing_budget", "customer timing & budget", () => db.from("jobs").select("urgency, needed_by, customer_budget").limit(1)],
    ["20261002031601_launch_growth", "launch & growth (Plus, promos, tips, disputes)", () => db.from("promo_codes").select("code").limit(1)],
    ["20261002134642_launch_checklist", "business & legal checklist", () => db.from("launch_checklist").select("key").limit(1)],
    ["20261002141249_message_language", "message language", () => db.from("jobs").select("locale").limit(1)],
    ["20261002223400_waitlist_google_reviews", "waitlist & Google reviews", () => db.from("waitlist").select("id").limit(1)],
    ["20261003001500_seasonal_quote_followups", "seasonal reminders & quote follow-ups", () => db.from("saved_quotes").select("id").limit(1)],
    ["20261003003900_contract_records", "contract records (My contracts)", () => db.from("contract_acceptances").select("id").limit(1)],
    ["20261003004900_contract_language", "contract language", () => db.from("contract_acceptances").select("locale").limit(1)],
    ["20261003011700_pro_fairness", "pro fairness (deductions, standing)", () => db.from("pro_deductions").select("id").limit(1)],
    ["20261003014600_market_pricing", "market pricing", () => db.from("market_factors").select("service_slug").limit(1)],
    ["20261003020600_pro_lead_engine", "pro lead engine", () => db.from("pro_leads").select("id").limit(1)],
    ["20261003130300_crews_fast_track", "crews & fast track", () => db.from("crew_members").select("id").limit(1)],
    ["20261004193200_business_growth", "business accounts, launch sets, sales engine, photo ID", () => db.from("business_invoices").select("id").limit(1)],
    ["20261004220400_board_favorites", "job board, favorites, crew requests", () => db.from("customer_favorites").select("id").limit(1)],
    ["20261005012800_biz_job_posts", "job-posting leads", () => db.from("biz_leads").select("job_title").limit(1)],
    ["20261005014100_email_center", "Email Center", () => db.from("email_campaigns").select("id").limit(1)],
    ["20261005021600_job_checklists", "job checklists", () => db.from("job_checklist_checks").select("id").limit(1)],
    ["20261005024000_pro_interviews", "pro screening interviews", () => db.from("pro_interviews").select("id").limit(1)],
    ["20261005041000_pro_rewards", "pro rewards", () => db.from("reward_ledger").select("id").limit(1)],
    ["20261005144100_gov_contracts", "government contracts", () => db.from("gov_opportunities").select("notice_id").limit(1)],
    ["20261005195400_bid_engine", "bid engine", () => db.from("bids").select("id").limit(1)],
    ["20261005203400_handled_talent", "Handled Talent", () => db.from("talent_clients").select("id").limit(1)],
    ["20261005203900_bid_archive", "bid archive & revisions", () => db.from("bids").select("revision").limit(1)],
    ["20261005213900_account_notes", "account notes", () => db.from("account_notes").select("id").limit(1)],
    ["20261006032400_factoring_partners", "factoring partners", () => db.from("factoring_partners").select("slug").limit(1)],
    ["20261006070800_app_payments", "in-app payments (Apple Pay / Google Pay)", () => db.from("payments").select("stripe_payment_intent_id").limit(1)],
    ["20261006075200_agent_tasks", "agent tasks", () => db.from("agent_tasks").select("id").limit(1)],
    ["20261006084100_business_rfp_scope", "business RFP scope", () => db.from("business_accounts").select("rfp_scope").limit(1)],
    ["20261006195000_job_coverage", "job coverage (backup pros)", () => db.from("job_backups").select("job_id").limit(1)],
    ["20261006201000_pro_business_address", "pro place of business", () => db.from("contractors").select("base_address, base_city").limit(1)],
    ["20261006215500_xero_accounting", "Xero accounting", () => db.from("xero_sync_log").select("id").limit(1)],
    ["20261007010000_referral_partners", "referral partner program", () => db.from("partner_commissions").select("id").limit(1)],
    ["20261022040000_referral_tickets", "referral tickets (Standard Referral Ticket RT-1, photos, 20% / 15%)", () => db.from("referral_tickets").select("id, photos, details, completeness").limit(1)],
    ["20261007023000_site_settings_grand_opening", "website looks, promo-code discount guard fix", () => db.from("site_settings").select("key").limit(1)],
    ["20261007030000_bid_measurements", "bid measurements", () => db.from("bid_cost_lines").select("measure_size, measure_unit").limit(1)],
    ["20261007040000_loyalty_points", "Handled Points (loyalty)", () => db.from("loyalty_ledger").select("id").limit(1)],
    ["20261007080000_job_post_discovery", "job-post discovery", () => db.from("biz_leads").select("posting_pay, posted_at").limit(1)],
    ["20261011224200_notification_log", "notification log (Dispatch, job page)", () => db.from("notification_log").select("id").limit(1)],
    ["20261011225000_saved_checklists", "saved checklists (Hub → Checklists)", () => db.from("saved_checklists").select("id").limit(1)],
    ["20261012000500_dispatch_gaps", "texts inbox, saved homes, pro calendar feed, pro ZIPs", () => db.from("contractors").select("calendar_token, zips_only").limit(1)],
    ["20261012012100_id_numbers", "ID numbers (C-, B-, P-, S-)", () => db.from("customer_ids").select("customer_no").limit(1)],
    ["20261012152500_talent_flat_fee", "Handled Talent flat fee per hire", () => db.from("talent_searches").select("flat_fee").limit(1)],
    ["20261015030000_book_now_pay_after", "book now, pay after (25% + balance after the job; or run supabase/setup/ADD_BOOK_NOW_PAY_AFTER_2026-10-15_0300.sql)", () => db.from("jobs").select("balance_charge_at, balance_hold_intent, pay_in_full_discount").limit(1)],
    ["20261018024800_pro_resume_photo", "pro resume & photo, signing for a business (or run supabase/setup/ADD_PRO_RESUME_PHOTO_2026-10-18_0248.sql)", () => db.from("contractors").select("resume_uploaded_at, photo_uploaded_at, upload_reminders, agreement_signed_for").limit(1)],
    ["20261019201500_gov_awards", "SAM.gov contract awards (or run supabase/setup/RUN_ONCE_ALL_NEW_2026-10-21_0000.sql for every Oct 19–21 change)", () => db.from("gov_awards").select("award_key").limit(1)],
    ["20261019214000_gov_subcontracting", "subcontract targets (or run supabase/setup/RUN_ONCE_ALL_NEW_2026-10-21_0000.sql)", () => db.from("gov_awards").select("sub_score, awardee_size").limit(1)],
    ["20261019233000_gov_daily_picks", "AI bid desk daily picks (or run supabase/setup/RUN_ONCE_ALL_NEW_2026-10-21_0000.sql)", () => db.from("gov_opportunities").select("picked_at").limit(1)],
    ["20261020001500_call_desk", "Call desk (or run supabase/setup/RUN_ONCE_ALL_NEW_2026-10-21_0000.sql)", () => db.from("biz_leads").select("next_call_at, call_attempts").limit(1)],
    ["20261020010000_omnichannel", "Lead inbox & social media (or run supabase/setup/RUN_ONCE_ALL_NEW_2026-10-21_0000.sql)", () => db.from("social_posts").select("id").limit(1)],
    ["20261020020000_pro_marketplace", "pro prices & request-a-quote (or run supabase/setup/RUN_ONCE_ALL_NEW_2026-10-21_0000.sql)", () => db.from("quote_bids").select("id").limit(1)],
  ];
  // service areas beyond Metro Detroit (ADD_SERVICE_AREAS_AND_BID_MEASUREMENTS_*.sql)
  const { count: areas } = await db.from("markets").select("id", { count: "exact", head: true }).eq("active", true);
  add("Supabase", "Service areas", (areas ?? 0) > 1 ? true : "warn", `${areas ?? 0} active market(s)`, "Run supabase/setup/ADD_SERVICE_AREAS_AND_BID_MEASUREMENTS_2026-10-07_1640.sql (rest of Michigan) and ADD_WASHINGTON_SERVICE_AREAS_2026-10-07_1700.sql (Washington). Handled serves Michigan and Washington; a missing ZIP in those states is added when it is first booked");
  const results = await Promise.all(probes.map(async ([file, label, run]) => ({ file, label, error: (await run()).error })));
  for (const { file, label, error } of results)
    add(M, label[0].toUpperCase() + label.slice(1), !error, error ? `not applied (${error.message})` : `applied · ${file}`,
      `Supabase → SQL Editor → paste supabase/migrations/${file}.sql → Run. Run missing ones oldest first.`);
  const { count: inbound } = await db.from("sms_inbox").select("id", { count: "exact", head: true }).eq("direction", "in");
  if (has("TWILIO_AUTH_TOKEN")) add("Webhooks", "Twilio: replies come into the Hub", (inbound ?? 0) > 0 ? true : "warn", (inbound ?? 0) > 0 ? `${inbound} text(s) received` : "no text received yet — set the webhook once in Twilio",
    `Twilio → Phone Numbers → your number (or Messaging Service → Integration) → "A message comes in": Webhook, HTTP POST, ${siteUrlNow()}/api/webhooks/twilio — replies then land in Hub → Texts`);
  // Checkr and Instantly: proof their webhooks reach us (a result / an email event has come back)
  if (has("CHECKR_API_KEY")) {
    const [{ count: results }, { count: waiting }] = await Promise.all([
      db.from("recruiting_events").select("id", { count: "exact", head: true }).like("kind", "background_%").eq("actor", "checkr"),
      db.from("contractors").select("id", { count: "exact", head: true }).not("background_provider_id", "is", null).in("background_status", ["invited", "pending"]),
    ]);
    add("Webhooks", "Checkr: background results come back", (results ?? 0) > 0 ? true : "warn",
      (results ?? 0) > 0 ? `${results} result(s) received` : (waiting ?? 0) > 0 ? `${waiting} check(s) ordered, no result received yet` : "no check ordered yet — can't confirm",
      `Checkr → Account settings → Developer settings → Webhooks: add ${siteUrlNow()}/api/checkr/webhook (report.completed, report.suspended, report.canceled, invitation.completed)`);
  }
  if (has("INSTANTLY_API_KEY")) {
    const [{ count: events }, { count: sent }] = await Promise.all([
      db.from("pro_leads").select("id", { count: "exact", head: true }).in("status", ["clicked", "replied", "bounced", "unsubscribed"]),
      db.from("pro_leads").select("id", { count: "exact", head: true }).eq("status", "emailing"),
    ]);
    add("Webhooks", "Instantly: email events come back", !has("INSTANTLY_WEBHOOK_SECRET") || (events ?? 0) > 0 ? true : "warn",
      !has("INSTANTLY_WEBHOOK_SECRET") ? `optional — no webhook (it needs Instantly's Hypergrowth plan): replies are pulled from the API every 10 minutes${(events ?? 0) > 0 ? `; ${events} lead(s) updated so far` : ""}` : (events ?? 0) > 0 ? `${events} lead(s) updated by Instantly` : (sent ?? 0) > 0 ? `${sent} lead(s) emailed, no click / reply / bounce received yet` : "no invitations sent yet — can't confirm",
      `Set INSTANTLY_WEBHOOK_SECRET in Vercel, then Instantly → Settings → Webhooks: ${siteUrlNow()}/api/webhooks/instantly?secret=<INSTANTLY_WEBHOOK_SECRET>, events: email sent, link clicked, reply received, lead unsubscribed, email bounced`);
  }
  // carrier partner + freight cargo documents (ADD_3_LAKES_CARRIER_PARTNER_*.sql also adds the 'cargo' document kind)
  const { data: carrier } = await db.from("contractors").select("status, insured_until, license_number").eq("email", "dispatch@3lakeslogistics.com").maybeSingle();
  add("People", "Carrier partner (3 Lakes Logistics)", carrier?.status === "approved" ? true : "warn",
    !carrier ? "not added yet" : carrier.status === "approved" ? `approved${carrier.license_number ? ` · USDOT ${carrier.license_number}` : ""}` : `${carrier.status}: finish onboarding and verification`,
    !carrier ? "Run supabase/setup/ADD_3_LAKES_CARRIER_PARTNER_2026-10-11_1405.sql (PART 1) in the SQL editor — see docs/3_LAKES_CARRIER_PARTNER_2026-10-11_1405.md" : "Hub → Hiring & pros → 3 Lakes Logistics: verify insurance (incl. cargo), USDOT authority and payout, then approve");

  // ── Catalog, storage, people
  const { data: svc } = await db.from("services").select("slug, name, minimum");
  const rows = new Map(((svc ?? []) as { slug: string; name: string; minimum: number }[]).map((r) => [r.slug, r]));
  const missing = SERVICES.filter((s) => !rows.has(s.slug)).map((s) => s.slug);
  // names and minimums change when prices are recalibrated; the DB copy should follow the code
  const stale = SERVICES.filter((s) => { const r = rows.get(s.slug); return r && (r.name !== s.name || Number(r.minimum) !== s.minimum); }).map((s) => s.slug);
  add("Supabase", "Service catalog synced", missing.length === 0 && stale.length === 0, missing.length ? `${missing.length} missing: ${missing.join(", ")}` : stale.length ? `${stale.length} out of date: ${stale.join(", ")}` : `${SERVICES.length} services`, "Click “Sync service catalog” below");
  const { data: buckets } = await db.storage.listBuckets();
  for (const b of ["job-photos", "pro-docs"]) add("Supabase", `Storage bucket ${b}`, Boolean(buckets?.some((x) => x.id === b)), buckets?.some((x) => x.id === b) ? "exists (private)" : "missing", "Re-run the migrations — they create the buckets");

  const [{ count: admins }, { data: pros }, { count: demo }, { count: markets }] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }).in("role", ["admin", "dispatcher"]),
    db.from("contractors").select("trades, status"),
    db.from("contractors").select("id", { count: "exact", head: true }).like("email", "%.example"),
    db.from("markets").select("id", { count: "exact", head: true }).eq("active", true),
  ]);
  add("People", "Staff accounts", (admins ?? 0) > 0, `${admins ?? 0} admin/dispatcher`, "Sign in once, then in SQL: update profiles set role='admin' where email='you@…'");
  add("People", "Launch market", (markets ?? 0) > 0, `${markets ?? 0} active`, "Run supabase/seed.sql");
  const active = (pros ?? []).filter((p: { status: string }) => p.status === "approved");
  const uncovered = TRADES.filter((t) => !active.some((p: { trades: string[] }) => p.trades.includes(t.id))).map((t) => t.label);
  add("People", "Active pros", active.length > 0 ? (uncovered.length ? "warn" : true) : false, `${active.length} active${uncovered.length ? ` · no pro yet for: ${uncovered.join(", ")}` : ""}`, "Recruit at /pros, approve in Hub → Hiring & pros, verify documents, activate");
  add("People", "No demo data", (demo ?? 0) === 0, demo ? `${demo} demo pros (*.example) in this database` : "clean", "Delete demo rows: delete from contractors where email like '%.example'; (and their jobs)");
  return c;
}

type Add = (area: string, item: string, ok: boolean | "warn", detail: string, fix?: string) => void;

/** Live checks against the Stripe account itself (Hub → Setup). Each check reports and never throws. */
async function stripeAccountChecks(stripe: Stripe, add: Add, site: string) {
  const area = "Payments (Stripe)";
  const has = (k: string) => Boolean(process.env[k]?.trim());
  const pk = process.env.STRIPE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
  const sk = process.env.STRIPE_SECRET_KEY ?? "";
  if (!keysMatch(sk, pk)) add(area, "Live / test keys match", false, `secret key is ${keyMode(sk) ?? "unknown"}, publishable key is ${keyMode(pk) ?? "unknown"} — app payments will fail`, "Stripe → Developers → API keys: copy both keys from the same mode (live) into STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY");
  else if (pk) add(area, "Live / test keys match", true, `both ${keyMode(sk)}`);
  const whsec = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  if (whsec && !whsec.startsWith("whsec_")) add("Webhooks", "Stripe: signing secret format", false, "doesn't start with whsec_ — every webhook will be rejected", "Stripe → Developers → Webhooks → your endpoint → Signing secret → Reveal; paste it into STRIPE_WEBHOOK_SECRET (not the API key)");

  // the platform account: can it take cards and pay out?
  try {
    const me = await stripe.accounts.retrieveCurrent();
    const due = me.requirements?.currently_due ?? [];
    const ok = Boolean(me.charges_enabled && me.payouts_enabled) && !due.length;
    add(area, "Account activated", ok ? true : me.charges_enabled ? "warn" : false,
      ok ? "cards accepted, payouts to your bank on" : `${me.charges_enabled ? "cards accepted" : "can't accept cards yet"} · ${me.payouts_enabled ? "payouts on" : "payouts to your bank off"}${due.length ? ` · Stripe needs: ${due.slice(0, 4).join(", ")}${due.length > 4 ? "…" : ""}` : ""}`,
      "Stripe Dashboard → Settings → Business details / the activation banner: finish what Stripe asks for (bank account, identity, business info)");
  } catch (e) {
    add(area, "Account activated", "warn", `couldn't read the account: ${e instanceof Error ? e.message : e}`, "Use a full secret key (sk_), or give the restricted key read access to Account");
  }

  // the webhook endpoint: right URL, enabled, every event the app needs
  const want = `${site.replace(/\/$/, "")}/api/stripe/webhook`;
  const host = (u: string) => { try { const x = new URL(u); return `${x.host.replace(/^www\./, "")}${x.pathname.replace(/\/$/, "")}`; } catch { return u; } };
  try {
    const { data: hooks } = await stripe.webhookEndpoints.list({ limit: 100 });
    const ours = hooks.filter((h) => host(h.url) === host(want));
    // prefer the endpoint at the exact site address (www vs. bare domain): a redirect in front of the other never delivers
    const exact = (h: Stripe.WebhookEndpoint) => h.url.replace(/\/$/, "") === want;
    const live = ours.find((h) => h.status === "enabled" && exact(h)) ?? ours.find((h) => h.status === "enabled");
    if (!live) {
      const elsewhere = hooks.filter((h) => h.url.includes("/api/stripe/webhook")).map((h) => `${h.url} (${h.status})`);
      add("Webhooks", "Stripe: endpoint", false, ours.length ? `${want} is disabled` : `no endpoint for ${want}${elsewhere.length ? ` — found ${elsewhere.join(", ")}` : ""}`,
        `Stripe → Developers → Webhooks → Add endpoint: ${want}, select the events listed in the next check, then copy its signing secret into STRIPE_WEBHOOK_SECRET and redeploy`);
    } else {
      const missing = missingWebhookEvents(live.enabled_events);
      add("Webhooks", "Stripe: endpoint", true, `${live.url} · enabled · ${live.enabled_events.includes("*") ? "all events" : `${live.enabled_events.length} events`}`);
      add("Webhooks", "Stripe: events", missing.length ? (missing.includes("checkout.session.completed") ? false : "warn") : true,
        missing.length ? `missing ${missing.length}: ${missing.map((e) => `${e} (${STRIPE_WEBHOOK_EVENTS[e]})`).join("; ")}` : "every event the app uses",
        `Stripe → Developers → Webhooks → ${live.url} → Update details → add: ${missing.join(", ")}`);
      const extra = ours.filter((h) => h.id !== live.id);
      if (extra.length) add("Webhooks", "Stripe: duplicate endpoints", "warn", `${ours.length} endpoints point at ${want} — each has its own signing secret, so only one can match STRIPE_WEBHOOK_SECRET`,
        `Keep ${live.url}; delete ${extra.map((h) => h.url).join(", ")} in Stripe → Developers → Webhooks`);
    }
  } catch (e) {
    add("Webhooks", "Stripe: endpoint", "warn", `couldn't list endpoints: ${e instanceof Error ? e.message : e}`, "Check it by hand in Stripe → Developers → Webhooks");
  }

  // pros: connected accounts that can receive the Monday payout, and money to cover it
  try {
    const db = adminClient();
    const { data: pros } = await db.from("contractors").select("id, stripe_account_id").eq("status", "approved").limit(500);
    const list = (pros ?? []) as { id: string; stripe_account_id: string | null }[];
    const linked = list.filter((p) => p.stripe_account_id);
    const ready = (await Promise.all(linked.slice(0, 25).map((p) => connectReady(p.stripe_account_id)))).filter(Boolean).length;
    const sampled = Math.min(linked.length, 25);
    add(area, "Pros set up for payouts (Connect)", !list.length ? "warn" : ready === list.length ? true : "warn",
      !list.length ? "no approved pros yet" : `${linked.length} of ${list.length} approved pros started payout setup${sampled ? ` · ${ready} of ${sampled} checked can receive money` : ""}`,
      "Pros finish payout setup in Pro portal → Earnings. If no pro can start it, activate Connect in Stripe → Connect → Get started (Express accounts, platform profile)");
    const { data: owed } = await db.from("payouts").select("amount").eq("status", "approved");
    const total = ((owed ?? []) as { amount: number }[]).reduce((a, r) => a + Number(r.amount), 0);
    const bal = await stripe.balance.retrieve();
    const avail = (bal.available.find((x) => x.currency === "usd")?.amount ?? 0) / 100;
    const pending = (bal.pending.find((x) => x.currency === "usd")?.amount ?? 0) / 100;
    if (total > 0) add(area, "Money for Monday's payouts", avail >= total ? true : "warn", `$${avail.toFixed(2)} available ($${pending.toFixed(2)} pending) · $${total.toFixed(2)} approved for pros`,
      "Card payments take about 2 days to become available. Pros not covered wait for the next run; you can top up the balance in Stripe → Balance → Add funds");
  } catch (e) {
    add(area, "Pros set up for payouts (Connect)", "warn", `couldn't check: ${e instanceof Error ? e.message : e}`);
  }

  // Handled Plus manage / cancel
  try {
    const { data: cfg } = await stripe.billingPortal.configurations.list({ is_default: true, limit: 1 });
    add(area, "Customer billing portal", cfg.length && cfg[0].active ? true : "warn", cfg.length && cfg[0].active ? "set up (Handled Plus manage / cancel)" : "not set up — Handled Plus members can't manage or cancel themselves", "Stripe → Settings → Billing → Customer portal → Save");
  } catch {
    add(area, "Customer billing portal", "warn", "couldn't check", "Stripe → Settings → Billing → Customer portal → Save");
  }

  // year-end 1099-NEC for pros paid through Connect
  add(area, "1099 tax forms for pros", has("STRIPE_1099") ? true : "warn", has("STRIPE_1099") ? "Stripe files 1099-NEC for pros paid through Connect" : "not confirmed — nothing files pros' 1099-NEC in January yet",
    "Stripe → Connect → Tax forms (Settings → Connect → Tax reporting): turn on 1099-NEC e-filing and delivery, then set STRIPE_1099=on in Vercel");
}
