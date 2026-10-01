/*
 * FILE    : apps/mobile/lib/supabase.ts
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-01_1800 UTC
 * PURPOSE : Supabase client (session in AsyncStorage) + authenticated calls to the web API.
 */
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL ?? "", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "", {
  auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

/** Call the Handled web API, attaching the signed-in user's token when there is one. */
export async function api<T = any>(path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: T }> {
  const { data } = await supabase.auth.getSession();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (!(init.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  return { ok: res.ok, status: res.status, data: (await res.json().catch(() => ({}))) as T };
}
