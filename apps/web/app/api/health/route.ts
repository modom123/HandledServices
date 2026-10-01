/*
 * FILE    : apps/web/app/api/health/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_1940 UTC
 * PURPOSE : Public uptime check — is the site up, which commit is live, can it reach the
 *           database. No secrets. Point an uptime monitor at /api/health.
 */
import { adminClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export async function GET() {
  let db: "ok" | "unreachable" | "not_configured" = "not_configured";
  if (supabaseConfigured && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { error } = await adminClient().from("services").select("slug", { head: true, count: "exact" });
    db = error ? "unreachable" : "ok";
  }
  return Response.json({ ok: db !== "unreachable", db, commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local", time: new Date().toISOString() });
}
