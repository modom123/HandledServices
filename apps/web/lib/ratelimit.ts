/*
 * FILE    : apps/web/lib/ratelimit.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_0316 UTC
 * PURPOSE : Abuse limits for public endpoints that cost money (AI) or storage (uploads), counted
 *           per visitor IP in Postgres (hit_rate_limit), so limits hold across serverless instances.
 *           Fails open if the database is unreachable — a broken limiter must not block customers.
 * UPDATED : 2026-10-05_0246 UTC — interview: candidate messages to the AI interviewer.
 */
import "server-only";
import { adminClient } from "./supabase/server";
import { supabaseConfigured } from "./supabase/env";

/** Per-IP limits: [max hits, window seconds]. */
export const LIMITS = {
  ai_quote: [30, 3600],
  concierge: [60, 3600],
  interview: [80, 3600],
  upload: [60, 3600],
  booking: [20, 3600],
  form: [10, 3600],
  tip: [20, 3600],
  error_report: [30, 600],
} as const satisfies Record<string, readonly [number, number]>;

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/** null = allowed; otherwise a 429 response to return. */
export async function rateLimit(req: Request, name: keyof typeof LIMITS, who?: string): Promise<Response | null> {
  if (!supabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const [max, win] = LIMITS[name];
  try {
    const { data, error } = await adminClient().rpc("hit_rate_limit", { p_key: `${name}:${who ?? clientIp(req)}`, p_window_seconds: win, p_max: max });
    if (error || data !== false) return null;
  } catch { return null; }
  return Response.json({ error: "Too many requests — please wait a few minutes and try again." }, { status: 429, headers: { "Retry-After": "600" } });
}
