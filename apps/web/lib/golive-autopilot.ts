/*
 * FILE    : apps/web/lib/golive-autopilot.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-04_1759 UTC
 * PURPOSE : Go-live autopilot — Mastermind → Go-live setup fixes what it can through each provider's API, so the
 *           owner isn't copying values between dashboards:
 *             secrets        — generates CRON_SECRET, INVOICE_SIGNING_SECRET, LEAD_INTAKE_SECRET, GOLIVE_API_KEY and
 *                              IEBC_API_KEY when missing and saves them in Vercel (Vercel REST API)
 *             site URL       — NEXT_PUBLIC_SITE_URL from the Vercel production domain
 *             Stripe webhook — creates the endpoint with every event the app uses (or adds missing events) and saves
 *                              the new signing secret straight into Vercel as STRIPE_WEBHOOK_SECRET
 *             Stripe portal  — creates the customer billing portal (Handled Plus manage / cancel)
 *             Twilio         — points the number / Messaging Service "message comes in" webhook at the Hub
 *             migrations     — runs every database migration the readiness check finds missing, oldest first
 *                              (Supabase Management API), stopping at the first error
 *             catalog        — re-syncs the service catalog
 *             redeploy       — one production redeploy when any Vercel setting changed, so it takes effect
 *           plus autoTickChecklist(): business & legal items that an API can prove are ticked ("Autopilot"), and items
 *           an API can only partly prove get an "Autopilot:" note. A person's tick or note is never overwritten.
 *           One-time tokens that unlock it (all server-only, in Vercel): VERCEL_TOKEN, VERCEL_PROJECT_ID (VERCEL_TEAM_ID
 *           for a team project) and SUPABASE_ACCESS_TOKEN. Never returns secret values.
 */
import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { BRAND, STRIPE_WEBHOOK_EVENTS, keyMode, missingWebhookEvents } from "@handled/core";
import { adminClient } from "./supabase/server";
import { getStripe } from "./stripe";
import type Stripe from "stripe";
import { siteUrl } from "./notify";
import { smsConfigured, twilioAuth } from "./sms";
import { syncCatalog } from "./catalog";
import type { Check } from "./readiness";

export type StepStatus = "done" | "todo" | "skipped" | "failed" | "ok";
export type Step = { id: string; title: string; status: StepStatus; detail: string };

const has = (k: string) => Boolean(process.env[k]?.trim());
const env = (k: string) => process.env[k]?.trim() ?? "";
export const vercelReady = () => has("VERCEL_TOKEN") && has("VERCEL_PROJECT_ID");
export const supabaseMgmtReady = () => has("SUPABASE_ACCESS_TOKEN") && Boolean(supabaseRef());
const supabaseRef = () => env("NEXT_PUBLIC_SUPABASE_URL").match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? env("SUPABASE_PROJECT_REF");

/** `Authorization: Bearer <GOLIVE_API_KEY>` (or x-golive-key) — lets an agent, Zapier or a script use the go-live API. */
export function goLiveKeyOk(req: Request): boolean {
  const want = env("GOLIVE_API_KEY");
  if (want.length < 24) return false;
  const got = req.headers.get("x-golive-key") ?? req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1] ?? "";
  const a = Buffer.from(got), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ─── Vercel ────────────────────────────────────────────────────────────────

async function vercel(p: string, init: RequestInit = {}) {
  const team = env("VERCEL_TEAM_ID");
  const url = `https://api.vercel.com${p}${team ? `${p.includes("?") ? "&" : "?"}teamId=${encodeURIComponent(team)}` : ""}`;
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${env("VERCEL_TOKEN")}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Vercel ${res.status}: ${json?.error?.message ?? res.statusText}`);
  return json;
}

/** Create or replace one environment variable for production + preview. */
async function setVercelEnv(key: string, value: string) {
  await vercel(`/v10/projects/${encodeURIComponent(env("VERCEL_PROJECT_ID"))}/env?upsert=true`, {
    method: "POST",
    body: JSON.stringify({ key, value, type: key.startsWith("NEXT_PUBLIC_") ? "plain" : "encrypted", target: ["production", "preview"] }),
  });
}

/** Rebuild the latest production deployment so new settings take effect. */
async function redeployProduction(): Promise<string> {
  const pid = encodeURIComponent(env("VERCEL_PROJECT_ID"));
  const { deployments } = await vercel(`/v6/deployments?projectId=${pid}&target=production&state=READY&limit=1`);
  const last = deployments?.[0];
  if (!last) throw new Error("no production deployment to redeploy");
  const d = await vercel(`/v13/deployments?forceNew=1`, { method: "POST", body: JSON.stringify({ name: last.name, deploymentId: last.uid, target: "production" }) });
  return String(d.url ?? d.id ?? "started");
}

// ─── Supabase migrations ───────────────────────────────────────────────────

async function migrationSql(file: string): Promise<string | null> {
  const dirs = [path.join(process.cwd(), "supabase/migrations"), path.join(process.cwd(), "../../supabase/migrations"), path.join(process.cwd(), "../supabase/migrations")];
  for (const d of dirs) {
    try { return await readFile(path.join(d, `${file}.sql`), "utf8"); } catch { /* next */ }
  }
  return null;
}

async function runSql(query: string) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${supabaseRef()}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${env("SUPABASE_ACCESS_TOKEN")}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

/** Migration files the readiness probes found missing, oldest first. */
function missingMigrations(checks: Check[]): string[] {
  const files = checks.filter((c) => c.group === "Database migrations" && c.status === "fail")
    .map((c) => c.fix?.match(/supabase\/migrations\/([\w-]+)\.sql/)?.[1]).filter((x): x is string => Boolean(x));
  return [...new Set(files)].sort();
}

// ─── Twilio ────────────────────────────────────────────────────────────────

async function twilio(url: string, form?: Record<string, string>) {
  const [u, p] = twilioAuth()!;
  const res = await fetch(url, {
    method: form ? "POST" : "GET",
    headers: { Authorization: `Basic ${Buffer.from(`${u}:${p}`).toString("base64")}`, ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: form ? new URLSearchParams(form) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${json?.message ?? res.statusText}`);
  return json;
}

// ─── The run ───────────────────────────────────────────────────────────────

/**
 * dryRun: report what would change, change nothing. Otherwise fix everything the connected APIs allow.
 * `checks` is the current readiness report (used for the missing migrations and the catalog state).
 */
export async function runAutopilot(checks: Check[], { dryRun }: { dryRun: boolean }): Promise<{ steps: Step[]; redeploy: string | null }> {
  const steps: Step[] = [];
  const step = (id: string, title: string, status: StepStatus, detail: string) => steps.push({ id, title, status, detail });
  const site = siteUrl().replace(/\/+$/, "");
  const envChanged: string[] = [];
  const needVercel = "connect Vercel first (VERCEL_TOKEN + VERCEL_PROJECT_ID)";

  // 1. Generated secrets
  const secrets: [string, number, string][] = [
    ["CRON_SECRET", 16, "scheduled jobs (dispatch, sweep, brief). Vercel's own crons pick it up; the GitHub Actions dispatch needs the same value as its CRON_SECRET secret"],
    ["INVOICE_SIGNING_SECRET", 16, "invoice link signing"],
    ["LEAD_INTAKE_SECRET", 16, "Zapier / Make lead intake"],
    ["GOLIVE_API_KEY", 24, "the go-live API (agents and scripts can tick checklist items)"],
    ["IEBC_API_KEY", 16, "IEBC agents — paste the same value into IEBC MasterHub → Handled Ops (copy it from Vercel)"],
  ];
  for (const [key, min, why] of secrets) {
    if (env(key).length >= min) { step(`secret:${key}`, key, "ok", "already set"); continue; }
    if (!vercelReady()) { step(`secret:${key}`, key, "skipped", needVercel); continue; }
    if (dryRun) { step(`secret:${key}`, key, "todo", `generate a random value and save it in Vercel — ${why}`); continue; }
    try { await setVercelEnv(key, randomBytes(32).toString("hex")); envChanged.push(key); step(`secret:${key}`, key, "done", `generated and saved in Vercel — ${why}`); }
    catch (e) { step(`secret:${key}`, key, "failed", String(e instanceof Error ? e.message : e)); }
  }

  // 2. Site URL from the production domain
  const cur = env("NEXT_PUBLIC_SITE_URL");
  const prod = env("VERCEL_PROJECT_PRODUCTION_URL");
  if (cur.startsWith("https://") && !cur.includes("localhost")) step("site_url", "Site URL", "ok", cur);
  else if (!prod) step("site_url", "Site URL", "skipped", "Vercel didn't report a production domain — add your domain in Vercel → Domains first");
  else if (!vercelReady()) step("site_url", "Site URL", "skipped", needVercel);
  else if (dryRun) step("site_url", "Site URL", "todo", `set NEXT_PUBLIC_SITE_URL = https://${prod}`);
  else {
    try { await setVercelEnv("NEXT_PUBLIC_SITE_URL", `https://${prod}`); envChanged.push("NEXT_PUBLIC_SITE_URL"); step("site_url", "Site URL", "done", `set to https://${prod}`); }
    catch (e) { step("site_url", "Site URL", "failed", String(e instanceof Error ? e.message : e)); }
  }

  // 3. Stripe webhook + 4. billing portal
  const stripe = getStripe();
  if (!stripe) {
    step("stripe_webhook", "Stripe webhook", "skipped", "add STRIPE_SECRET_KEY first (only you can copy it from Stripe → Developers → API keys)");
  } else {
    const want = `${site}/api/stripe/webhook`;
    const events = Object.keys(STRIPE_WEBHOOK_EVENTS);
    try {
      const { data: hooks } = await stripe.webhookEndpoints.list({ limit: 100 });
      const ours = hooks.find((h) => h.url.replace(/\/$/, "") === want && h.status === "enabled");
      const secretOk = env("STRIPE_WEBHOOK_SECRET").startsWith("whsec_");
      if (ours) {
        const missing = missingWebhookEvents(ours.enabled_events);
        if (missing.length) {
          if (dryRun) step("stripe_webhook", "Stripe webhook events", "todo", `add ${missing.length} missing event(s) to ${want}`);
          else { await stripe.webhookEndpoints.update(ours.id, { enabled_events: [...new Set([...ours.enabled_events, ...missing])] as Stripe.WebhookEndpointUpdateParams.EnabledEvent[] }); step("stripe_webhook", "Stripe webhook events", "done", `added ${missing.join(", ")}`); }
        } else step("stripe_webhook", "Stripe webhook", "ok", `${want} · every event the app uses`);
        if (!secretOk) step("stripe_webhook_secret", "Stripe signing secret", "skipped", `Stripe only shows an existing endpoint's secret once. Either paste it from Stripe → Developers → Webhooks → ${want} → Signing secret into STRIPE_WEBHOOK_SECRET, or delete that endpoint and run autopilot again — it will create a new one and save its secret for you`);
      } else if (!vercelReady()) {
        step("stripe_webhook", "Stripe webhook", "skipped", `${needVercel} — the new endpoint's signing secret has to be saved in Vercel`);
      } else if (dryRun) {
        step("stripe_webhook", "Stripe webhook", "todo", `create ${want} with ${events.length} events and save its signing secret as STRIPE_WEBHOOK_SECRET`);
      } else {
        const created = await stripe.webhookEndpoints.create({ url: want, enabled_events: events as Stripe.WebhookEndpointCreateParams.EnabledEvent[], description: `${BRAND.name} (created by Go-live autopilot)` });
        if (created.secret) { await setVercelEnv("STRIPE_WEBHOOK_SECRET", created.secret); envChanged.push("STRIPE_WEBHOOK_SECRET"); }
        step("stripe_webhook", "Stripe webhook", "done", `created ${want} (${keyMode(env("STRIPE_SECRET_KEY")) ?? "?"} mode) and saved its signing secret in Vercel`);
      }
    } catch (e) { step("stripe_webhook", "Stripe webhook", "failed", String(e instanceof Error ? e.message : e)); }

    try {
      const { data: cfg } = await stripe.billingPortal.configurations.list({ is_default: true, limit: 1 });
      if (cfg[0]?.active) step("stripe_portal", "Stripe billing portal", "ok", "set up");
      else if (dryRun) step("stripe_portal", "Stripe billing portal", "todo", "create the customer portal (update card, invoices, cancel Handled Plus at period end)");
      else {
        await stripe.billingPortal.configurations.create({
          business_profile: { headline: `${BRAND.name} — manage your membership`, privacy_policy_url: `${site}/privacy`, terms_of_service_url: `${site}/terms` },
          default_return_url: `${site}/account`,
          features: {
            customer_update: { enabled: true, allowed_updates: ["email", "address", "phone"] },
            invoice_history: { enabled: true },
            payment_method_update: { enabled: true },
            subscription_cancel: { enabled: true, mode: "at_period_end" },
          },
        });
        step("stripe_portal", "Stripe billing portal", "done", "created");
      }
    } catch (e) { step("stripe_portal", "Stripe billing portal", "failed", String(e instanceof Error ? e.message : e)); }
  }

  // 5. Twilio "message comes in" webhook
  if (!smsConfigured()) step("twilio_webhook", "Twilio incoming texts", "skipped", "add the Twilio keys first (only you can copy them from the Twilio Console)");
  else {
    const hook = `${site}/api/webhooks/twilio`;
    const sid = env("TWILIO_ACCOUNT_SID"), mg = env("TWILIO_MESSAGING_SERVICE_SID");
    try {
      if (mg) {
        const svc = await twilio(`https://messaging.twilio.com/v1/Services/${mg}`);
        if (svc.inbound_request_url === hook && svc.use_inbound_webhook_on_number === false) step("twilio_webhook", "Twilio incoming texts", "ok", `Messaging Service → ${hook}`);
        else if (dryRun) step("twilio_webhook", "Twilio incoming texts", "todo", `point Messaging Service ${mg} at ${hook}`);
        else { await twilio(`https://messaging.twilio.com/v1/Services/${mg}`, { InboundRequestUrl: hook, InboundMethod: "POST", UseInboundWebhookOnNumber: "false" }); step("twilio_webhook", "Twilio incoming texts", "done", `Messaging Service → ${hook}`); }
      } else {
        const list = await twilio(`https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(env("TWILIO_FROM"))}`);
        const num = list.incoming_phone_numbers?.[0];
        if (!num) step("twilio_webhook", "Twilio incoming texts", "failed", `${env("TWILIO_FROM")} isn't a number on this Twilio account`);
        else if (num.sms_url === hook) step("twilio_webhook", "Twilio incoming texts", "ok", `${num.phone_number} → ${hook}`);
        else if (dryRun) step("twilio_webhook", "Twilio incoming texts", "todo", `point ${num.phone_number} at ${hook}`);
        else { await twilio(`https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers/${num.sid}.json`, { SmsUrl: hook, SmsMethod: "POST" }); step("twilio_webhook", "Twilio incoming texts", "done", `${num.phone_number} → ${hook}`); }
      }
    } catch (e) { step("twilio_webhook", "Twilio incoming texts", "failed", String(e instanceof Error ? e.message : e)); }
  }

  // 6. Database migrations
  const files = missingMigrations(checks);
  if (!files.length) step("migrations", "Database migrations", "ok", "all applied");
  else if (!supabaseMgmtReady()) step("migrations", "Database migrations", "skipped", `${files.length} missing — connect Supabase first (SUPABASE_ACCESS_TOKEN)`);
  else if (dryRun) step("migrations", "Database migrations", "todo", `run ${files.length} missing, oldest first: ${files.join(", ")}`);
  else {
    const ran: string[] = [];
    for (const f of files) {
      const sql = await migrationSql(f);
      if (!sql) { step("migrations", "Database migrations", "failed", `${ran.length ? `ran ${ran.join(", ")}; ` : ""}couldn't find ${f}.sql in this deployment`); break; }
      try { await runSql(sql); ran.push(f); }
      catch (e) { step("migrations", "Database migrations", "failed", `${ran.length ? `ran ${ran.join(", ")}; ` : ""}${f} failed — ${e instanceof Error ? e.message : e}`); break; }
    }
    if (ran.length === files.length) step("migrations", "Database migrations", "done", `ran ${ran.length}: ${ran.join(", ")}`);
  }

  // 7. Service catalog
  const catalog = checks.find((c) => c.label === "Service catalog synced");
  if (!catalog || catalog.status === "ok") step("catalog", "Service catalog", "ok", "in sync");
  else if (dryRun) step("catalog", "Service catalog", "todo", catalog.detail);
  else { const r = await syncCatalog(true); step("catalog", "Service catalog", r.ok ? "done" : "failed", r.ok ? `synced ${r.count} services` : r.error ?? "failed"); }

  // 8. Business & legal items an API can prove
  if (!dryRun) await autoTickChecklist().catch(() => null);

  // 9. One redeploy so changed settings take effect
  let redeploy: string | null = null;
  if (envChanged.length && !dryRun) {
    try { redeploy = await redeployProduction(); step("redeploy", "Redeploy", "done", `${envChanged.length} setting(s) changed — production is rebuilding (${redeploy}); give it about 2 minutes`); }
    catch (e) { step("redeploy", "Redeploy", "failed", `settings saved, but redeploy failed (${e instanceof Error ? e.message : e}) — Vercel → Deployments → Redeploy`); }
  }
  return { steps, redeploy };
}

// ─── Business & legal: proof from APIs ─────────────────────────────────────

type Tick = { key: string; done_at: string | null; done_by: string | null; note: string | null };
const AUTO = "Autopilot";

/**
 * Tick items an API proves (done_by "Autopilot"), untick our own ticks when the proof goes away, and leave an
 * "Autopilot:" note on items an API can only partly prove. A person's tick or note is never touched.
 */
export async function autoTickChecklist(): Promise<void> {
  if (!has("SUPABASE_SERVICE_ROLE_KEY")) return;
  const db = adminClient();
  const { data, error } = await db.from("launch_checklist").select("key, done_at, done_by, note");
  if (error) return;
  const by = new Map(((data ?? []) as Tick[]).map((t) => [t.key, t]));
  const today = new Date().toISOString().slice(0, 10);
  const proofs: { key: string; proven: boolean; note: string | null }[] = [];

  const stripe = getStripe();
  if (stripe) {
    try {
      const me = await stripe.accounts.retrieveCurrent();
      const live = keyMode(env("STRIPE_SECRET_KEY")) === "live";
      const connect = await stripe.accounts.list({ limit: 1 }).then(() => true, () => false);
      const ok = live && Boolean(me.charges_enabled && me.payouts_enabled) && connect;
      proofs.push({ key: "biz_stripe", proven: ok, note: ok ? `${AUTO}: Stripe live, cards and payouts on, Connect enabled (checked ${today})` : `${AUTO}: ${!live ? "Stripe key is in test mode" : !me.charges_enabled ? "Stripe can't accept cards yet" : !me.payouts_enabled ? "Stripe payouts are off" : "Connect isn't enabled"} (checked ${today})` });
      const company = me.business_type === "company" && me.company?.tax_id_provided;
      proofs.push({ key: "biz_entity", proven: false, note: company && me.payouts_enabled ? `${AUTO}: Stripe has the company with an EIN on file and a bank account for payouts — confirm the Michigan registration, then tick (checked ${today})` : null });
    } catch { /* leave as is */ }
  }
  proofs.push({ key: "biz_1099", proven: env("STRIPE_1099") === "on", note: env("STRIPE_1099") === "on" ? `${AUTO}: Stripe files and delivers 1099-NEC for pros paid through Connect (STRIPE_1099=on)` : null });

  const mg = env("TWILIO_MESSAGING_SERVICE_SID");
  if (smsConfigured() && mg) {
    try {
      const [brands, campaigns] = await Promise.all([
        twilio("https://messaging.twilio.com/v1/a2p/BrandRegistrations?PageSize=20"),
        twilio(`https://messaging.twilio.com/v1/Services/${mg}/Compliance/Usa2p`),
      ]);
      const brand = (brands.data ?? []).map((b: { status: string }) => b.status).find((s: string) => s === "APPROVED") ?? brands.data?.[0]?.status ?? "none";
      const camp = (campaigns.compliance ?? []).map((c: { campaign_status: string }) => c.campaign_status)[0] ?? "none";
      proofs.push({ key: "law_sms", proven: false, note: `${AUTO}: A2P 10DLC brand ${brand} · campaign ${camp}${brand === "APPROVED" && camp === "VERIFIED" ? " — registration done; tick once an attorney has reviewed the consent wording" : ""} (checked ${today})` });
    } catch { /* leave as is */ }
  }

  for (const p of proofs) {
    const t = by.get(p.key);
    const human = Boolean(t?.done_at && t.done_by !== AUTO);
    const noteIsOurs = !t?.note || t.note.startsWith(`${AUTO}:`);
    const row: Record<string, unknown> = { key: p.key, updated_at: new Date().toISOString() };
    let change = false;
    if (!human) {
      if (p.proven && !t?.done_at) { row.done_at = new Date().toISOString(); row.done_by = AUTO; change = true; }
      if (!p.proven && t?.done_by === AUTO) { row.done_at = null; row.done_by = null; change = true; }
    }
    if (noteIsOurs && p.note !== (t?.note ?? null) && (p.note || t?.note)) { row.note = p.note; change = true; }
    if (change) await db.from("launch_checklist").upsert(row);
  }
}
