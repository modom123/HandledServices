/*
 * FILE    : apps/mobile/lib/session.tsx
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-06_0645 UTC
 * PURPOSE : Who is signed in, shared by every screen (one /api/me call instead of one per screen).
 *           Cached on the phone so the app opens straight into the right mode (customer or pro)
 *           even on a bad connection; refreshed on sign-in, sign-out and when the app comes back
 *           to the foreground.
 *             const { me, ready, refresh } = useSession();
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, supabase } from "./supabase";

export type Me = { email: string; role: string; contractorId: string | null } | null;

const KEY = "handled_me";
const Ctx = createContext<{ me: Me; ready: boolean; refresh: () => Promise<void> }>({ me: null, ready: false, refresh: async () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me>(null);
  const [ready, setReady] = useState(false);
  const refresh = useCallback(async () => {
    let session = null;
    try { session = (await supabase.auth.getSession()).data.session; } catch { session = null; }
    if (!session) { setMe(null); setReady(true); AsyncStorage.removeItem(KEY).catch(() => {}); return; }
    const r = await api<{ user: Me }>("/api/me");
    if (r.ok) { setMe(r.data.user ?? null); AsyncStorage.setItem(KEY, JSON.stringify(r.data.user ?? null)).catch(() => {}); }
    // offline: keep what we knew (cached), so a pro still lands in Pro mode
    setReady(true);
  }, []);
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v) { try { setMe(JSON.parse(v)); } catch { /* ignore */ } } }).catch(() => {}).finally(refresh);
    const { data } = supabase.auth.onAuthStateChange((e) => { if (e === "SIGNED_IN" || e === "SIGNED_OUT" || e === "USER_UPDATED") refresh(); });
    const app = AppState.addEventListener("change", (st) => { if (st === "active") refresh(); });
    return () => { data.subscription.unsubscribe(); app.remove(); };
  }, [refresh]);
  return <Ctx.Provider value={{ me, ready, refresh }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
