/*
 * FILE    : apps/web/lib/call-schedule.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_1530 UTC
 * PURPOSE : Call appointments on the server: the call hours (site_settings "call_hours", set in Hub → Lead inbox; the
 *           core default until set), the calls already booked (leads.call_at, not lost / spam), the open slots, and the
 *           check that a requested time is still open. Rules: packages/core/src/call-schedule.ts.
 */
import "server-only";
import { DEFAULT_CALL_HOURS, callSlots, cleanCallHours, isOpenCallSlot, type CallHours } from "@handled/core";
import { adminClient } from "./supabase/server";
import { supabaseConfigured } from "./supabase/env";

export const CALL_HOURS_KEY = "call_hours";
const ready = () => supabaseConfigured && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function getCallHours(): Promise<CallHours> {
  if (!ready()) return DEFAULT_CALL_HOURS;
  try {
    const { data } = await adminClient().from("site_settings").select("value").eq("key", CALL_HOURS_KEY).maybeSingle();
    return data?.value ? cleanCallHours(data.value) : DEFAULT_CALL_HOURS;
  } catch { return DEFAULT_CALL_HOURS; }
}

/** Booked call times from now to the end of the horizon. Empty before the migration is run. */
export async function bookedCalls(h: CallHours): Promise<string[]> {
  if (!ready()) return [];
  const from = new Date(Date.now() - 3600000).toISOString();
  const to = new Date(Date.now() + (h.horizonDays + 2) * 86400000).toISOString();
  const { data, error } = await adminClient().from("leads").select("call_at, status").gte("call_at", from).lte("call_at", to).limit(5000);
  if (error) return [];
  return (data ?? []).filter((r) => !["lost", "spam"].includes(String(r.status ?? ""))).map((r) => String(r.call_at));
}

export async function openCallSlots() {
  const h = await getCallHours();
  return { hours: h, days: callSlots(h, await bookedCalls(h)) };
}

export async function callSlotOpen(at: string): Promise<boolean> {
  const h = await getCallHours();
  return isOpenCallSlot(h, await bookedCalls(h), at);
}

/** A time zone the browser sent, if it's a real one. */
export const safeTz = (tz: unknown): string | null => {
  if (typeof tz !== "string" || !tz || tz.length > 60) return null;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; } catch { return null; }
};
