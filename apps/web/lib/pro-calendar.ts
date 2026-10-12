/*
 * FILE    : apps/web/lib/pro-calendar.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-12_0005 UTC
 * PURPOSE : Pro calendar sync. Each pro gets a secret feed URL (contractors.calendar_token) that Google Calendar, Apple
 *           Calendar or Outlook subscribe to; it lists the pro's jobs from 30 days back to 90 ahead with the time window,
 *           address and a link to the job. Entry details and lockbox codes are never in the feed. Regenerating the link
 *           turns the old one off.
 */
import "server-only";
import { randomBytes } from "node:crypto";
import { BRAND, buildIcs, getService, windowRange, type IcsEvent } from "@handled/core";
import { adminClient } from "./supabase/server";
import { siteUrl } from "./notify";

const db = () => adminClient();
const SHOWN = ["assigned", "in_progress", "qa_review", "completed", "cancelled"];

/** The pro's feed URL (https and webcal), creating the secret the first time or replacing it when `rotate`. */
export async function calendarLinks(contractorId: string, rotate = false): Promise<{ https: string; webcal: string; google: string } | null> {
  const { data: c, error } = await db().from("contractors").select("calendar_token").eq("id", contractorId).maybeSingle();
  if (error || !c) return null;
  let token = (c as { calendar_token: string | null }).calendar_token;
  if (!token || rotate) {
    token = randomBytes(24).toString("base64url");
    const { error: e } = await db().from("contractors").update({ calendar_token: token }).eq("id", contractorId);
    if (e) return null;
  }
  const https = `${siteUrl()}/api/pro/calendar/${token}`;
  const webcal = https.replace(/^https?:/, "webcal:");
  return { https, webcal, google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}` };
}

/** The iCalendar feed for a token, or null when the token is unknown. */
export async function calendarFeed(token: string): Promise<string | null> {
  if (!/^[\w-]{20,64}$/.test(token)) return null;
  const { data: pro } = await db().from("contractors").select("id, business_name").eq("calendar_token", token).maybeSingle();
  if (!pro) return null;
  const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  const { data: jobs } = await db().from("jobs").select("id, ref, service_slug, status, scheduled_date, time_window, address, city, state, zip, contact_name")
    .eq("contractor_id", pro.id).gte("scheduled_date", from).lte("scheduled_date", to).in("status", SHOWN).order("scheduled_date").limit(500);
  const events: IcsEvent[] = ((jobs ?? []) as { id: string; ref: string; service_slug: string; status: string; scheduled_date: string; time_window: string; address: string; city: string; state: string; zip: string; contact_name: string }[]).map((j) => {
    const svc = getService(j.service_slug);
    const { start, end } = windowRange(j);
    return {
      uid: `${j.id}@handledsvc.com`, start, end, cancelled: j.status === "cancelled",
      summary: `${svc?.icon ?? ""} ${svc?.name ?? j.service_slug} · ${j.ref}${j.status === "cancelled" ? " (cancelled)" : ""}`.trim(),
      location: `${j.address}, ${j.city}, ${j.state} ${j.zip}`,
      description: `${BRAND.name} job ${j.ref} for ${j.contact_name.split(" ")[0]}. Arrive within the window. Scope, checklist and entry details: ${siteUrl()}/pro/jobs/${j.id}`,
      url: `${siteUrl()}/pro/jobs/${j.id}`,
    };
  });
  return buildIcs(`${BRAND.name} jobs — ${pro.business_name}`, events);
}
