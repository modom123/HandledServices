/*
 * FILE    : apps/web/lib/roster.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_0255 UTC
 * PURPOSE : Pro whereabouts and schedule, server side (rules live in @handled/core roster.ts):
 *             setOnCall()          — pro switches "On call" on (for N hours) or off
 *             recordLocation()     — phone location, accepted only while on call or on a job today
 *             proSchedule()        — the pro's calendar: jobs ahead, days off, open slots
 *             setDayOff()          — block or reopen a day (not one that already has jobs)
 *             liveRoster()         — Hub: every active pro's status, location and week ahead
 *             clearStaleLocations()— sweep: forget locations older than 12 hours
 * UPDATED : 2026-10-07_1900 UTC — a pro's "today" (location sharing, schedule, days off) uses their own time zone (Pacific in Washington).
 */
import "server-only";
import {
  ON_CALL_DEFAULT_HOURS, ON_CALL_MAX_HOURS, PRO_STATUS_LABEL, liveLocation, localDate, milesBetween, onCall, proCalendar, proStatus,
  type Contractor, type TimeWindow, proTimeZone } from "@handled/core";
import { adminClient } from "./supabase/server";

const db = () => adminClient();
const ACTIVE = ["assigned", "in_progress"];
type JobRow = { id: string; ref: string; service_slug: string; scheduled_date: string | null; time_window: TimeWindow; status: string; city: string | null; contractor_id: string | null };

async function activeJobToday(contractorId: string, today = localDate()) {
  const { count } = await db().from("jobs").select("id", { count: "exact", head: true }).eq("contractor_id", contractorId).eq("scheduled_date", today).in("status", ACTIVE);
  return (count ?? 0) > 0;
}

export async function setOnCall(contractorId: string, on: boolean, hours = ON_CALL_DEFAULT_HOURS) {
  const until = on ? new Date(Date.now() + Math.min(ON_CALL_MAX_HOURS, Math.max(1, hours)) * 3600000).toISOString() : null;
  const patch: Record<string, unknown> = { on_call_until: until };
  // going off call with no job today → stop keeping their location
  if (!on && !(await activeJobToday(contractorId))) Object.assign(patch, { last_lat: null, last_lng: null, last_located_at: null });
  await db().from("contractors").update(patch).eq("id", contractorId);
  return { onCall: on, until };
}

export async function recordLocation(contractorId: string, lat: number, lng: number) {
  const { data: c } = await db().from("contractors").select("on_call_until, base_zip").eq("id", contractorId).single();
  if (!c) return { ok: false, error: "Pro not found" };
  if (!onCall(c) && !(await activeJobToday(contractorId, localDate(new Date(), proTimeZone(c))))) return { ok: false, error: "Location is only shared while you're on call or on a job today." };
  await db().from("contractors").update({ last_lat: lat, last_lng: lng, last_located_at: new Date().toISOString() }).eq("id", contractorId);
  return { ok: true };
}

export async function proSchedule(contractorId: string, days = 35) {
  const { data: c } = await db().from("contractors").select("*").eq("id", contractorId).single();
  const from = localDate(new Date(), proTimeZone((c ?? {}) as { base_zip?: string | null })); // the pro's own "today" (Pacific in Washington)
  const to = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const [{ data: jobs }] = await Promise.all([
    db().from("jobs").select("id, ref, service_slug, scheduled_date, time_window, status, city").eq("contractor_id", contractorId).gte("scheduled_date", from).lte("scheduled_date", to).neq("status", "cancelled").order("scheduled_date"),
  ]);
  if (!c) return null;
  const pro = c as Contractor;
  return {
    onCall: onCall(pro), onCallUntil: pro.on_call_until ?? null,
    capacity: pro.daily_capacity, availability: pro.availability ?? null,
    days: proCalendar(pro, (jobs ?? []) as JobRow[], from, days),
  };
}

export async function setDayOff(contractorId: string, date: string, off: boolean) {
  const { data: c } = await db().from("contractors").select("time_off, base_zip").eq("id", contractorId).single();
  const today = localDate(new Date(), proTimeZone((c ?? {}) as { base_zip?: string | null }));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) return { ok: false, error: "Pick today or a future date" };
  const cur = new Set<string>((c?.time_off ?? []) as string[]);
  if (off) {
    const { count } = await db().from("jobs").select("id", { count: "exact", head: true }).eq("contractor_id", contractorId).eq("scheduled_date", date).in("status", ACTIVE);
    if (count) return { ok: false, error: `You have ${count} job${count > 1 ? "s" : ""} that day. Message support to hand ${count > 1 ? "them" : "it"} off first.` };
    cur.add(date);
  } else cur.delete(date);
  // keep the list short: drop past days
  const time_off = [...cur].filter((d) => d >= today).sort().slice(0, 180);
  await db().from("contractors").update({ time_off }).eq("id", contractorId);
  return { ok: true, time_off };
}

export async function liveRoster() {
  const today = localDate();
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const [{ data: pros }, { data: jobs }] = await Promise.all([
    db().from("contractors").select("*").eq("status", "approved").order("business_name"),
    db().from("jobs").select("id, ref, service_slug, scheduled_date, time_window, status, city, contractor_id, lat, lng").not("contractor_id", "is", null).gte("scheduled_date", today).lte("scheduled_date", weekEnd).neq("status", "cancelled"),
  ]);
  const rows = ((pros ?? []) as Contractor[]).map((c) => {
    const mine = ((jobs ?? []) as (JobRow & { lat: number | null; lng: number | null })[]).filter((j) => j.contractor_id === c.id);
    const todays = mine.filter((j) => j.scheduled_date === today);
    const status = proStatus(c, todays);
    const here = liveLocation(c);
    const current = todays.find((j) => j.status === "in_progress") ?? todays.find((j) => j.status === "assigned");
    const toJob = here && current?.lat != null && current?.lng != null ? milesBetween(here, { lat: current.lat, lng: current.lng }) : null;
    const week = proCalendar(c, mine, today, 7);
    return {
      id: c.id, name: c.business_name, contact: c.contact_name, phone: c.phone, trades: c.trades,
      status, statusLabel: PRO_STATUS_LABEL[status], onCallUntil: onCall(c) ? c.on_call_until : null,
      location: here, baseZip: c.base_zip ?? c.zip ?? null, radius: c.service_radius_mi ?? 25,
      today: todays.map((j) => ({ id: j.id, ref: j.ref, service: j.service_slug, window: j.time_window, status: j.status, city: j.city })),
      milesToJob: toJob == null ? null : Math.round(toJob * 10) / 10,
      week: week.map((d) => ({ date: d.date, off: d.off, booked: d.jobs.length, capacity: d.capacity })),
    };
  });
  const order = { on_job: 0, on_call: 1, booked: 2, working: 3, off: 4 } as const;
  return rows.sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name));
}

/** Daily sweep: forget phone locations older than 12 hours (privacy) and lapsed on-call flags. */
export async function clearStaleLocations() {
  const cutoff = new Date(Date.now() - 12 * 3600000).toISOString();
  const { data } = await db().from("contractors").update({ last_lat: null, last_lng: null, last_located_at: null }).lt("last_located_at", cutoff).select("id");
  await db().from("contractors").update({ on_call_until: null }).lt("on_call_until", new Date().toISOString());
  return data?.length ?? 0;
}
