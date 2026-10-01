/*
 * FILE    : apps/web/lib/supabase/server.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Supabase clients for server code. `serverClient()` acts as the signed-in
 *           user (RLS applies). `adminClient()` uses the service role and bypasses RLS —
 *           only call it after an explicit authorization check.
 */
import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./env";

export async function serverClient() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // called from a Server Component — proxy.ts refreshes the session instead
        }
      },
    },
  });
}

/** A client that acts as the user identified by a bearer token (mobile app). */
export function tokenClient(accessToken: string) {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Untyped (no generated Database types yet) — run `supabase gen types` to tighten this.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let admin: SupabaseClient<any, "public", any> | null = null;
export function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) throw new Error("Supabase service role is not configured (SUPABASE_SERVICE_ROLE_KEY).");
  admin ??= createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}
