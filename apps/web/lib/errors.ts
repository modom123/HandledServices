/*
 * FILE    : apps/web/lib/errors.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : Error monitoring without a vendor: server errors (instrumentation.ts), website
 *           crashes (error pages) and app crashes (mobile) become Hub alerts, de-duplicated to
 *           one per error per hour. Errors on money and dispatch paths (payments, Stripe,
 *           bookings, cron) are critical — they also email OPS_EMAIL right away.
 */
import "server-only";
import { adminClient } from "./supabase/server";
import { opsEmail, sendEmail } from "./notify";
import { BRAND } from "@handled/core";

const CRITICAL = /\/api\/(stripe|bookings|cron|pay|account\/jobs\/[^/]+\/(cancel|tip)|pro\/payouts)/;

export async function reportError(e: { source: "server" | "web" | "app"; message: string; path?: string | null; digest?: string | null; stack?: string | null; extra?: string | null }) {
  try {
    const msg = (e.message || "Unknown error").replace(/\s+/g, " ").slice(0, 200);
    const title = `[${e.source}] ${msg}`.slice(0, 240);
    const db = adminClient();
    const hourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count } = await db.from("ops_alerts").select("id", { count: "exact", head: true }).eq("kind", "error").eq("title", title).gte("created_at", hourAgo);
    if (count) return;
    const critical = e.source === "server" && CRITICAL.test(e.path ?? "");
    const body = [e.path && `Where: ${e.path}`, e.digest && `Digest: ${e.digest}`, e.extra, e.stack && e.stack.slice(0, 1500)].filter(Boolean).join("\n");
    await db.from("ops_alerts").insert({ kind: "error", severity: critical ? "critical" : "warn", title, body });
    if (critical && opsEmail()) await sendEmail(opsEmail(), `[${BRAND.name} error] ${msg}`, body);
  } catch (err) {
    console.error("[reportError] couldn't record", err, e.message);
  }
}
