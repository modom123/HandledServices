/*
 * FILE    : apps/web/lib/readiness.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_1940 UTC
 * UPDATED : 2026-10-02_1329 UTC — text messages (Twilio), Stripe dispute/subscription webhook events,
 *           sales tax, Vercel Pro for the 10-minute dispatch cron, migrations 13–16.
 * UPDATED : 2026-10-02_2252 UTC — Google review link check; migration 19 (waitlist & Google reviews).
 * UPDATED : 2026-10-03_0027 UTC — migration 20 (seasonal reminders & quote follow-ups).
 * UPDATED : 2026-10-03_0124 UTC — migrations 21–23 (contract records, contract language, pro fairness).
 * UPDATED : 2026-10-03_0210 UTC — lead engine keys; migrations 24–25 (market pricing, pro lead engine).
 * UPDATED : 2026-10-03_0324 UTC — lead engine sends through Instantly.
 * PURPOSE : Go-live readiness checks behind Hub → Setup: environment, database migrations,
 *           catalog sync, storage, Stripe, people and demo-data leaks. Reports presence and
 *           validity only — never secret values.
 * UPDATED : 2026-10-03_1418 UTC — checks migration 26 (crews & fast track) and flags catalog rows whose name or minimum is out of date.
 * UPDATED : 2026-10-04_1934 UTC — migration 27 (business accounts, launch sets, sales engine, photo ID) and the business sales engine key.
 * UPDATED : 2026-10-04_2204 UTC — migration 29 (open job board, customer favorites, crew member requests).
 * UPDATED : 2026-10-05_0130 UTC — migration 30 (job-posting leads for the business sales engine).
 */
import "server-only";
import { BRAND, BRAND_PLACEHOLDERS, SERVICES, TRADES } from "@handled/core";
import { adminClient } from "./supabase/server";
import { supabaseConfigured } from "./supabase/env";
import { getStripe } from "./stripe";

export type Check = { group: string; label: string; status: "ok" | "warn" | "fail"; detail: string; fix?: string };

const has = (k: string) => Boolean(process.env[k]?.trim());

export async function readiness(): Promise<Check[]> {
  const c: Check[] = [];
  const add = (group: string, label: string, ok: boolean | "warn", detail: string, fix?: string) =>
    c.push({ group, label, status: ok === true ? "ok" : ok === "warn" ? "warn" : "fail", detail, fix: ok === true ? undefined : fix });

  // ── Environment
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  add("Website & Vercel", "Site URL", site.startsWith("https://") ? true : "warn", site || "not set", "Vercel → Settings → Environment Variables → NEXT_PUBLIC_SITE_URL = https://your-domain (used in every email link)");
  add("Website & Vercel", "Support email & phone", !BRAND_PLACEHOLDERS, BRAND_PLACEHOLDERS ? "still the placeholder support@handled.example / (555)" : "set", "Set NEXT_PUBLIC_SUPPORT_EMAIL and NEXT_PUBLIC_SUPPORT_PHONE in Vercel (and EXPO_PUBLIC_… for the app)");
  add("Website & Vercel", "Google review link", BRAND.googleReviewUrl ? true : "warn", BRAND.googleReviewUrl || "not set — customers aren't asked to review us on Google", "Google Business Profile → Ask for reviews → copy the link → set NEXT_PUBLIC_GOOGLE_REVIEW_URL in Vercel and EXPO_PUBLIC_GOOGLE_REVIEW_URL for the app");
  add("Pro recruiting", "Lead engine: finding pros", has("GOOGLE_PLACES_API_KEY") ? true : "warn", has("GOOGLE_PLACES_API_KEY") ? "Google Places key set" : "not set — CSV import only", "Google Cloud → enable Places API (New) → create an API key (restrict it to Places API) → GOOGLE_PLACES_API_KEY in Vercel. Then turn the engine on in Hub → Pro leads");
  add("Pro recruiting", "Lead engine: invitations (Instantly)", has("INSTANTLY_API_KEY") && has("INSTANTLY_CAMPAIGN_ID") && has("BUSINESS_POSTAL_ADDRESS") && has("INSTANTLY_WEBHOOK_SECRET") ? true : "warn", !has("INSTANTLY_API_KEY") ? "not set — no invitation emails" : !has("INSTANTLY_CAMPAIGN_ID") ? "INSTANTLY_CAMPAIGN_ID missing" : !has("BUSINESS_POSTAL_ADDRESS") ? "BUSINESS_POSTAL_ADDRESS missing" : !has("INSTANTLY_WEBHOOK_SECRET") ? "INSTANTLY_WEBHOOK_SECRET missing — replies/unsubscribes won't sync" : "set", `Instantly: connect warmed-up inboxes on a separate domain, create the campaign (steps {{subject_1}}/{{body_1}} … see docs/LEAD_ENGINE_SETUP_*), API key (v2) → INSTANTLY_API_KEY, campaign id → INSTANTLY_CAMPAIGN_ID, webhook ${site || "https://your-domain"}/api/webhooks/instantly?secret=… → INSTANTLY_WEBHOOK_SECRET; plus BUSINESS_POSTAL_ADDRESS (CAN-SPAM)`);
  add("Business sales", "Sales engine: business emails (Instantly)", has("INSTANTLY_API_KEY") && has("INSTANTLY_BIZ_CAMPAIGN_ID") && has("BUSINESS_POSTAL_ADDRESS") ? true : "warn", !has("INSTANTLY_BIZ_CAMPAIGN_ID") ? "INSTANTLY_BIZ_CAMPAIGN_ID not set — no business sales emails" : "set", "Create a second Instantly campaign (steps {{subject_1}}/{{body_1}} … 3) → INSTANTLY_BIZ_CAMPAIGN_ID; turn it on in Hub → Business leads");
  add("Website & Vercel", "Cron secret", has("CRON_SECRET"), has("CRON_SECRET") ? "set" : "missing — daily brief & sweep will 401", "Add CRON_SECRET (any long random string) in Vercel");
  add("Website & Vercel", "Invoice link signing", has("INVOICE_SIGNING_SECRET") ? true : "warn", has("INVOICE_SIGNING_SECRET") ? "set" : "falling back to the service role key", "Add INVOICE_SIGNING_SECRET (long random string)");
  add("Supabase", "Project URL & public key", supabaseConfigured, supabaseConfigured ? "set" : "missing", "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from Supabase → Project Settings → API");
  add("Supabase", "Service role key", has("SUPABASE_SERVICE_ROLE_KEY"), has("SUPABASE_SERVICE_ROLE_KEY") ? "set" : "missing", "Add SUPABASE_SERVICE_ROLE_KEY (server only) from Supabase → Project Settings → API");
  add("AI (Claude)", "Anthropic API key", has("ANTHROPIC_API_KEY") ? true : "warn", has("ANTHROPIC_API_KEY") ? "set" : "missing — quotes/dispatch/QA fall back to rules, chat & assistant offline", "Add ANTHROPIC_API_KEY from console.anthropic.com");
  add("Email", "Resend", has("RESEND_API_KEY") && has("EMAIL_FROM") ? true : "warn", has("RESEND_API_KEY") ? `from ${process.env.EMAIL_FROM ?? "(EMAIL_FROM missing)"}` : "missing — emails are only logged", "Add RESEND_API_KEY + EMAIL_FROM and verify your sending domain in Resend");
  add("Email", "Ops inbox", has("OPS_EMAIL") ? true : "warn", process.env.OPS_EMAIL ?? "missing", "Add OPS_EMAIL — receives critical alerts, new pro applications and the daily brief");
  add("Text messages", "Twilio SMS", has("TWILIO_ACCOUNT_SID") && has("TWILIO_AUTH_TOKEN") && (has("TWILIO_MESSAGING_SERVICE_SID") || has("TWILIO_FROM")) ? true : "warn",
    has("TWILIO_ACCOUNT_SID") ? "set" : "missing — customers and pros get push + email only", "Twilio → buy a number, register A2P 10DLC for business texting, then set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_MESSAGING_SERVICE_SID (or TWILIO_FROM)");
  add("Website & Vercel", "Vercel plan (10-minute dispatch)", process.env.VERCEL_PLAN === "pro" ? true : "warn", process.env.VERCEL_PLAN === "pro" ? "Pro" : "confirm you're on Vercel Pro — Hobby runs crons once a day and doesn't allow commercial use", "Upgrade the Vercel team to Pro, then set VERCEL_PLAN=pro to clear this check");
  add("Mobile app", "Push notifications", has("EXPO_ACCESS_TOKEN") ? true : "warn", has("EXPO_ACCESS_TOKEN") ? "Expo access token set" : "works without it; add EXPO_ACCESS_TOKEN for signed push requests", "expo.dev → Account → Access tokens → create → add EXPO_ACCESS_TOKEN in Vercel");
  add("IEBC workforce", "IEBC API key", has("IEBC_API_KEY") ? true : "warn", has("IEBC_API_KEY") ? "set" : "missing — IEBC agents can't connect", "Add IEBC_API_KEY (openssl rand -hex 32) and paste the same key in IEBC MasterHub → Handled Ops");
  add("IEBC workforce", "Allowed origin", has("IEBC_ALLOWED_ORIGIN") ? true : "warn", process.env.IEBC_ALLOWED_ORIGIN ?? "* (any website may call with the key)", "Set IEBC_ALLOWED_ORIGIN to the MasterHub's web address");

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
    add("Payments (Stripe)", "Webhook secret", has("STRIPE_WEBHOOK_SECRET"), has("STRIPE_WEBHOOK_SECRET") ? "set" : "missing — paid bookings won't dispatch", `Stripe → Developers → Webhooks → endpoint ${site || "https://your-domain"}/api/stripe/webhook, events checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, charge.dispute.created, charge.dispute.updated, charge.dispute.closed, customer.subscription.created, customer.subscription.updated and customer.subscription.deleted; copy the signing secret`);
    add("Payments (Stripe)", "Sales tax", process.env.STRIPE_TAX === "on" ? true : "warn", process.env.STRIPE_TAX === "on" ? "Stripe Tax on — tax added where the service is taxable" : "off — fine in Michigan for most services; turn on before adding states that tax services", "Stripe → Tax → add your registrations, then set STRIPE_TAX=on");
    add("Payments (Stripe)", "Customer billing portal", true, "used for Handled Plus manage/cancel — enable it in Stripe → Settings → Billing → Customer portal");
  // ── Pro recruiting (background checks)
  add("Pro recruiting", "Background checks (Checkr)", has("CHECKR_API_KEY") && has("CHECKR_PACKAGE") ? true : "warn",
    has("CHECKR_API_KEY") ? (has("CHECKR_PACKAGE") ? "automated — ordered as soon as a pro's W-9 and agreement are in" : "CHECKR_PACKAGE missing") : "manual — ops gets a task to order each check",
    `Checkr → Account settings → API keys: set CHECKR_API_KEY and CHECKR_PACKAGE (your package slug); add the webhook ${site || "https://your-domain"}/api/checkr/webhook (report.completed, report.suspended, report.canceled, invitation.completed)`);
  }

  if (!supabaseConfigured || !has("SUPABASE_SERVICE_ROLE_KEY")) return c;
  const db = adminClient();

  // ── Database migrations (probe one object each adds)
  const probes: [string, () => PromiseLike<{ error: { message: string } | null }>][] = [
    ["1 init (jobs, pros, RLS)", () => db.from("jobs").select("id").limit(1)],
    ["2 IEBC workforce", () => db.from("iebc_agents").select("id").limit(1)],
    ["3 take-rate guard", () => db.from("payouts").select("id").limit(1)],
    ["4 upfront payment", () => db.from("jobs").select("paid_at, amount_paid, remedy").limit(1)],
    ["5 contractor workforce & ratings", () => db.from("contractor_scorecard").select("contractor_id").limit(1)],
    ["5b ratings", () => db.from("ops_ratings").select("id").limit(1)],
    ["6 service agreement", () => db.from("jobs").select("terms_version").limit(1)],
    ["7 offers & push notifications", () => db.from("push_tokens").select("id").limit(1)],
    ["8 deposits & Quick Charge", () => db.from("jobs").select("payment_plan, deposit_paid_at").limit(1)],
    ["9 pro vetting", () => db.from("contractors").select("specialties, coverage").limit(1)],
    ["10 pro benefits", () => db.from("pro_program_settings").select("id").limit(1)],
    ["11 dispatch geo & availability", () => db.from("zip_geo").select("zip").limit(1)],
    ["12 pro recruiting", () => db.from("recruiting_events").select("id").limit(1)],
    ["13 pro promises", () => db.from("contractors").select("referral_bonus_paid_at").limit(1)],
    ["14 pro roster (on call, location)", () => db.from("contractors").select("on_call_until, last_located_at").limit(1)],
    ["15 customer timing & budget", () => db.from("jobs").select("urgency, needed_by, customer_budget").limit(1)],
    ["16 launch & growth (Plus, promos, tips, disputes)", () => db.from("promo_codes").select("code").limit(1)],
    ["17 business & legal checklist", () => db.from("launch_checklist").select("key").limit(1)],
    ["18 message language", () => db.from("jobs").select("locale").limit(1)],
    ["19 waitlist & Google reviews", () => db.from("waitlist").select("id").limit(1)],
    ["20 seasonal reminders & quote follow-ups", () => db.from("saved_quotes").select("id").limit(1)],
    ["21 contract records (My contracts)", () => db.from("contract_acceptances").select("id").limit(1)],
    ["22 contract language", () => db.from("contract_acceptances").select("locale").limit(1)],
    ["23 pro fairness (deductions, standing)", () => db.from("pro_deductions").select("id").limit(1)],
    ["24 market pricing", () => db.from("market_factors").select("service_slug").limit(1)],
    ["25 pro lead engine", () => db.from("pro_leads").select("id").limit(1)],
    ["26 crews & fast track", () => db.from("crew_members").select("id").limit(1)],
    ["27 business accounts, launch sets, sales engine, photo ID", () => db.from("business_invoices").select("id").limit(1)],
    ["29 job board, favorites, crew requests", () => db.from("customer_favorites").select("id").limit(1)],
    ["30 job-posting leads", () => db.from("biz_leads").select("job_title").limit(1)],
  ];
  for (const [label, run] of probes) {
    const { error } = await run();
    add("Supabase", `Migration ${label}`, !error, error ? error.message : "applied", "Run supabase/setup/HANDLED_SETUP_*.sql (new project) or the missing file in supabase/migrations in the SQL editor");
  }

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
