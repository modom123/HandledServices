/*
 * FILE    : apps/web/lib/visit.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : The visit itself, for customers:
 *             onMyWay()       — pro taps "On my way": customer gets a text + push with a live link
 *             trackPro()      — "Your pro is ~12 minutes away": distance and ETA from the pro's
 *                               fresh phone location, only while they're on the way or on site
 *                               for this job, today; location rounded to ~100 m
 *             rescheduleJob() — customer moves their booking to another open day/window
 *                               (free until 24 hours before); keeps the pro if they're free
 */
import "server-only";
import { BRAND, TIME_WINDOW_LABEL, getService, isRush, liveLocation, localDate, milesBetween, offDuty, type Contractor, type Job, type TimeWindow } from "@handled/core";
import { adminClient } from "./supabase/server";
import { addEvent, dispatchJob, getJob, raiseAlert } from "./jobs";
import { notify } from "./push";
import { siteUrl } from "./notify";

const db = () => adminClient();

/** Road distance ≈ 1.3 × straight line; ~25 mph average in town, plus 3 minutes to park. */
export function etaMinutes(miles: number) {
  return Math.max(2, Math.round((miles * 1.3) / 25 * 60 + 3));
}

export async function onMyWay(jobId: string, contractorId: string) {
  const job = await getJob(jobId);
  if (!job || job.contractor_id !== contractorId || job.status !== "assigned") return { ok: false, error: "Not an upcoming job of yours" };
  if (job.scheduled_date !== localDate()) return { ok: false, error: "This job isn't today" };
  await db().from("jobs").update({ en_route_at: new Date().toISOString() }).eq("id", jobId);
  const { data: pro } = await db().from("contractors").select("business_name, contact_name").eq("id", contractorId).single();
  const link = `${siteUrl()}/account/jobs/${jobId}`;
  await addEvent(jobId, "en_route", `${pro?.contact_name?.split(" ")[0] ?? "Your pro"} is on the way.`, "pro");
  await notify(job.customer_id, {
    title: "Your pro is on the way 🚗", body: `${pro?.business_name ?? "Your pro"} is heading to you now. Track them live.`, data: { type: "job", jobId },
    sms: { to: job.contact_phone, body: `${BRAND.name}: ${pro?.contact_name?.split(" ")[0] ?? "Your pro"} from ${pro?.business_name ?? "your pro"} is on the way for your ${getService(job.service_slug)?.name}. Track live: ${link}` },
  });
  return { ok: true };
}

export async function trackPro(job: Job) {
  const live = ["assigned", "in_progress"].includes(job.status) && job.scheduled_date === localDate() && (job.en_route_at || job.status === "in_progress");
  if (!live || !job.contractor_id) return { tracking: false as const };
  if (job.status === "in_progress") return { tracking: true as const, arrived: true };
  const { data: c } = await db().from("contractors").select("last_lat, last_lng, last_located_at, contact_name").eq("id", job.contractor_id).single();
  const here = c ? liveLocation(c as Contractor) : null;
  if (!here || job.lat == null || job.lng == null) return { tracking: true as const, arrived: false, name: c?.contact_name?.split(" ")[0] ?? null, eta: null };
  const miles = milesBetween(here, { lat: job.lat, lng: job.lng });
  return {
    tracking: true as const, arrived: false, name: c?.contact_name?.split(" ")[0] ?? null,
    miles: Math.round(miles * 10) / 10, eta: etaMinutes(miles), updatedMinAgo: here.minutesAgo,
    pro: { lat: Math.round(here.lat * 1000) / 1000, lng: Math.round(here.lng * 1000) / 1000 }, home: { lat: job.lat, lng: job.lng },
  };
}

export async function rescheduleJob(jobId: string, customerId: string, date: string, window: TimeWindow) {
  const job = await getJob(jobId);
  if (!job || job.customer_id !== customerId) return { ok: false, error: "Booking not found" };
  if (!["requested", "quoted", "scheduled", "dispatched", "assigned"].includes(job.status)) return { ok: false, error: "This booking can't be moved now — message support." };
  if (job.scheduled_date) {
    const hoursLeft = (new Date(`${job.scheduled_date}T08:00:00`).getTime() - Date.now()) / 3600000;
    if (hoursLeft < 24) return { ok: false, error: "Less than 24 hours to go — please message support to move it." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date <= localDate()) return { ok: false, error: "Pick a future date" };
  if (isRush(date) && !isRush(job.scheduled_date)) return { ok: false, error: "Dates within 48 hours carry a priority fee — pick a later date, or message support." };
  // is the open slot still there? (same check as booking)
  const { GET: availability } = await import("@/app/api/availability/route");
  const a = await (await availability(new Request(`http://local/api/availability?service=${job.service_slug}&zip=${job.zip}`))).json();
  const day = a.days?.find((d: { date: string }) => d.date === date);
  if (a.mode === "live" && (!day || day.closed || day.level === "full" || (window !== "flexible" && day.windows[window] === 0))) return { ok: false, error: "That time is full — pick another." };

  const from = `${job.scheduled_date ?? "unscheduled"} ${job.time_window}`;
  let keepPro = false;
  if (job.contractor_id) {
    const { data: pro } = await db().from("contractors").select("*").eq("id", job.contractor_id).single();
    const { count } = await db().from("jobs").select("id", { count: "exact", head: true }).eq("contractor_id", job.contractor_id).eq("scheduled_date", date).neq("status", "cancelled");
    keepPro = Boolean(pro) && !offDuty(pro as Contractor, date, window) && (count ?? 0) < Math.max(1, (pro as Contractor).daily_capacity);
    if (!keepPro && pro) await notify((pro as Contractor).profile_id, { title: `Rescheduled: ${job.ref}`, body: `The customer moved this job to ${date} — it's been released since you're not free then.`, data: { type: "job_pro", jobId } });
    if (keepPro && pro) await notify((pro as Contractor).profile_id, { title: `Moved: ${job.ref}`, body: `The customer moved this job to ${date}, ${TIME_WINDOW_LABEL[window]}. It's still yours.`, data: { type: "job_pro", jobId }, email: { to: (pro as Contractor).email, subject: `Job moved — ${job.ref} is now ${date}`, text: `The customer moved ${job.ref} to ${date}, ${TIME_WINDOW_LABEL[window]}. It's still yours — nothing to do.` } });
  }
  await db().from("job_offers").update({ status: "taken" }).eq("job_id", jobId).eq("status", "offered");
  await db().from("jobs").update({
    scheduled_date: date, time_window: window, en_route_at: null,
    needed_by: job.needed_by && job.needed_by < date ? date : job.needed_by ?? null,
    ...(keepPro ? {} : { contractor_id: null, status: job.status === "assigned" ? "scheduled" : job.status }),
  }).eq("id", jobId);
  await addEvent(jobId, "rescheduled", `Moved from ${from} to ${date}, ${TIME_WINDOW_LABEL[window]}.${keepPro ? " Same pro." : ""}`, "customer");
  if (!keepPro && (job.paid_at || job.deposit_paid_at)) await dispatchJob(jobId).catch(async (e) => raiseAlert("dispatch", "warn", `${job.ref}: re-dispatch after reschedule failed`, String(e), jobId));
  return { ok: true, keptPro: keepPro };
}
