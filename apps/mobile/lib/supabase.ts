/*
 * FILE    : apps/mobile/lib/supabase.ts
 * PROJECT : Handled (HandledServices)
 * CREATED : 2026-10-01_1800 UTC
 * PURPOSE : Supabase client (session in AsyncStorage) + authenticated calls to the web API.
 * UPDATED : 2026-10-06_0645 UTC — never crashes or hangs: a build without the Supabase settings gets a
 *           placeholder client (configured = false, the app shows a setup screen instead of crashing at
 *           launch); api() never throws, times out after 20 s, and on no signal / timeout / server error
 *           returns ok:false with a plain-language data.error the screens already show.
 * UPDATED : 2026-10-06_0726 UTC — security: the session is kept in the iOS Keychain / Android Keystore (secure-storage.ts),
 *           not plain AsyncStorage; existing sessions move over without signing anyone out.
 * UPDATED : 2026-10-06_1955 UTC — the production Supabase URL and publishable key are built in (@handled/core SUPABASE_PUBLIC).
 */
import "react-native-url-polyfill/auto";
import { secureStorage } from "./secure-storage";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLIC } from "@handled/core";

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
// the production project's public URL and publishable key are built in; EXPO_PUBLIC_ variables still win
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || SUPABASE_PUBLIC.url;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_PUBLIC.publishableKey;

/** False when the build is missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. */
export const configured = Boolean(SUPABASE_URL && SUPABASE_KEY);

// createClient throws on an empty URL, which would crash the app before anything renders.
export const supabase = createClient(SUPABASE_URL || "https://not-configured.invalid", SUPABASE_KEY || "not-configured", {
  auth: { storage: secureStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

export const NETWORK_ERROR = "No connection. Check your signal or Wi-Fi and try again.";
export const TIMEOUT_ERROR = "This is taking too long. Check your connection and try again.";
export const SERVER_ERROR = "Something went wrong on our end. Please try again in a moment.";

export type ApiResult<T> = { ok: boolean; status: number; data: T & { error?: string }; offline?: boolean };

/**
 * Call the Handled web API, attaching the signed-in user's token when there is one.
 * Never throws: network failures and timeouts come back as { ok: false, status: 0, offline: true }.
 */
export async function api<T = any>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<ApiResult<T>> {
  const { timeoutMs = 20000, ...req } = init;
  let token: string | undefined;
  try { token = (await supabase.auth.getSession()).data.session?.access_token; } catch { token = undefined; }
  const headers: Record<string, string> = { ...(req.headers as Record<string, string>) };
  if (!(req.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_URL}${path}`, { ...req, headers, signal: ctrl.signal });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok && res.status >= 500 && !data?.error) (data as { error?: string }).error = SERVER_ERROR;
    return { ok: res.ok, status: res.status, data: data ?? ({} as T & { error?: string }) };
  } catch (e) {
    const timedOut = (e as { name?: string })?.name === "AbortError";
    return { ok: false, status: 0, offline: true, data: { error: timedOut ? TIMEOUT_ERROR : NETWORK_ERROR } as T & { error?: string } };
  } finally {
    clearTimeout(timer);
  }
}
