/*
 * FILE    : apps/mobile/lib/errors.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : App crash reporting → Hub alerts (/api/errors). Installs a global JS error handler
 *           that reports, then lets React Native show its normal crash behaviour.
 */
import { Platform } from "react-native";
import { API_URL } from "./supabase";

export function reportAppError(e: unknown, where = "") {
  const err = e instanceof Error ? e : new Error(String(e));
  fetch(`${API_URL}/api/errors`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: "app", message: err.message || "App error", path: where || undefined, stack: err.stack?.slice(0, 3000), extra: `${Platform.OS} ${Platform.Version}` }),
  }).catch(() => {});
}

let installed = false;
export function installErrorReporting() {
  if (installed) return;
  installed = true;
  const g = globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void } };
  const prev = g.ErrorUtils?.getGlobalHandler();
  g.ErrorUtils?.setGlobalHandler((e, fatal) => { reportAppError(e, fatal ? "fatal" : "global"); prev?.(e, fatal); });
}
