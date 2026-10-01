/*
 * FILE    : apps/web/lib/readiness.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_1940 UTC
 * PURPOSE : Go-live readiness checks behind Hub → Setup: environment, database migrations,
 *           catalog sync, storage, Stripe, people and demo-data leaks. Reports presence and
 *           validity only — never secret values.
 */
import "server-only";
import { BRAND_PLACEHOLDERS, SERVICES, TRADES } from "@handled/core";
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
  add("Website & Vercel", "Cron secret", has("CRON_SECRET"), has("CRON_SECRET") ? "set" : "missing — daily brief & sweep will 401", "Add CRON_SECRET (any long random string) in Vercel");
  add("Website & Vercel", "Invoice link signing", has("INVOICE_SIGNING_SECRET") ? true : "warn", has("INVOICE_SIGNING_SECRET") ? "set" : "falling back to the service role key", "Add INVOICE_SIGNING_SECRET (long random string)");
  add("Supabase", "Project URL & public key", supabaseConfigured, supabaseConfigured ? "set" : "missing", "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from Supabase → Project Settings → API");
  add("Supabase", "Service role key", has("SUPABASE_SERVICE_ROLE_KEY"), has("SUPABASE_SERVICE_ROLE_KEY") ? "set" : "missing", "Add SUPABASE_SERVICE_ROLE_KEY (server only) from Supabase → Project Settings → API");
  add("AI (Claude)", "Anthropic API key", has("ANTHROPIC_API_KEY") ? true : "warn", has("ANTHROPIC_API_KEY") ? "set" : "missing — quotes/dispatch/QA fall back to rules, chat & assistant offline", "Add ANTHROPIC_API_KEY from console.anthropic.com");
  add("Email", "Resend", has("RESEND_API_KEY") && has("EMAIL_FROM") ? true : "warn", has("RESEND_API_KEY") ? `from ${process.env.EMAIL_FROM ?? "(EMAIL_FROM missing)"}` : "missing — emails are only logged", "Add RESEND_API_KEY + EMAIL_FROM and verify your sending domain in Resend");
  add("Email", "Ops inbox", has("OPS_EMAIL") ? true : "warn", process.env.OPS_EMAIL ?? "missing", "Add OPS_EMAIL — receives critical alerts, new pro applications and the daily brief");
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
    add("Payments (Stripe)", "Webhook secret", has("STRIPE_WEBHOOK_SECRET"), has("STRIPE_WEBHOOK_SECRET") ? "set" : "missing — paid bookings won't dispatch", `Stripe → Developers → Webhooks → endpoint ${site || "https://your-domain"}/api/stripe/webhook, events checkout.session.completed, checkout.session.async_payment_succeeded and checkout.session.async_payment_failed; copy the signing secret`);
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
  ];
  for (const [label, run] of probes) {
    const { error } = await run();
    add("Supabase", `Migration ${label}`, !error, error ? error.message : "applied", "Run supabase/setup/HANDLED_SETUP_*.sql (new project) or the missing file in supabase/migrations in the SQL editor");
  }

  // ── Catalog, storage, people
  const { data: svc } = await db.from("services").select("slug");
  const inDb = new Set((svc ?? []).map((r: { slug: string }) => r.slug));
  const missing = SERVICES.filter((s) => !inDb.has(s.slug)).map((s) => s.slug);
  add("Supabase", "Service catalog synced", missing.length === 0, missing.length ? `${missing.length} missing: ${missing.join(", ")}` : `${SERVICES.length} services`, "Click “Sync service catalog” below");
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
