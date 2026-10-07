/*
 * FILE    : apps/web/lib/ratelimit.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_0316 UTC
 * PURPOSE : Abuse limits for public endpoints that cost money (AI) or storage (uploads), counted
 *           per visitor IP in Postgres (hit_rate_limit), so limits hold across serverless instances.
 *           Fails open if the database is unreachable — a broken limiter must not block customers.
 * UPDATED : 2026-10-05_0246 UTC — interview: candidate messages to the AI interviewer.
 * UPDATED : 2026-10-06_0708 UTC — pay: in-app payment sheets (Apple Pay / Google Pay).
 * UPDATED : 2026-10-06_2300 UTC — signin: sign-in code emails.
 * UPDATED : 2026-10-07_0245 UTC — signin_ip 40/hour and signin_email 8 per 15 min (10/hour per IP and email locked people out).
 * UPDATED : 2026-10-07_1640 UTC — signin_owner 30/hour for OWNER_EMAILS (they skip the shared limits but can't be flooded).
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
  pay: [30, 3600],
  error_report: [30, 600],
  signin: [10, 3600],        // (old name, unused)
  signin_ip: [40, 3600],     // sign-in code requests per connection (an office shares one) per hour
  signin_email: [8, 900],    // sign-in code requests per email address per 15 minutes
  signin_owner: [30, 3600],  // owner emails: generous (never locked out by others' limits) but not unlimited — no inbox flooding
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
