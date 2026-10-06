/*
 * FILE    : apps/mobile/lib/location.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_0255 UTC
 * PURPOSE : Pro location sharing — only while the pro is on call or on a job today, and only
 *           while the app is open (no background tracking). The server refuses locations at any
 *           other time and forgets them after 12 hours.
 * UPDATED : 2026-10-06_0708 UTC — useLiveRouteSharing(): while a pro is on the way to today's job (app open), their position
 *           streams every ~15 s / 40 m so the customer's map moves like a ride app; stops on arrival.
 */
import { useEffect } from "react";
import { AppState } from "react-native";
import * as Location from "expo-location";
import { api } from "./supabase";

/** Ask once (when-in-use), then send the current position. Returns false if not allowed. */
export async function shareLocationOnce(): Promise<boolean> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== "granted") return false;
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const r = await api("/api/pro/location", { method: "POST", body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }) });
  return r.ok;
}

/** While `active` and the app is in the foreground, share location now and every 5 minutes. */
export function useLocationSharing(active: boolean) {
  useEffect(() => {
    if (!active) return;
    shareLocationOnce().catch(() => {});
    const t = setInterval(() => { if (AppState.currentState === "active") shareLocationOnce().catch(() => {}); }, 5 * 60000);
    const sub = AppState.addEventListener("change", (st) => { if (st === "active") shareLocationOnce().catch(() => {}); });
    return () => { clearInterval(t); sub.remove(); };
  }, [active]);
}

/**
 * On the way to a job: stream the pro's position (every ~15 s or 40 m, app open) so the customer's
 * live map moves smoothly. Stops when `active` turns false (arrived / started) or the screen closes.
 */
export function useLiveRouteSharing(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let sub: Location.LocationSubscription | null = null;
    let last = 0;
    let stopped = false;
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync().catch(() => null);
      if (!perm || perm.status !== "granted" || stopped) return;
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 15000, distanceInterval: 40 }, (pos) => {
        const now = Date.now();
        if (now - last < 12000) return; // never more than one update every ~12 s
        last = now;
        api("/api/pro/location", { method: "POST", body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }) }).catch(() => {});
      }).catch(() => null);
      if (stopped) sub?.remove();
    })();
    return () => { stopped = true; sub?.remove(); };
  }, [active]);
}
