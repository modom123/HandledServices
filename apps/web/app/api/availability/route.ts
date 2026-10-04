/*
 * FILE    : apps/web/app/api/availability/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2115 UTC
 * PURPOSE : Booking calendar: open / limited / full for each day and arrival window over
 *           the booking horizon, from real pro capacity in the customer's ZIP.
 *           Counts only pros who work that day and window and drive as far as this ZIP.
 *           GET /api/availability?service=house-cleaning&zip=48201[&today=1]
 * UPDATED : TSTAMP UTC — mode "closed" when the service isn't open yet in the ZIP's city (launch set).
 * UPDATED : 2026-10-02_0301 UTC — today=1: same-day slots from pros who are on call or working today.
 */
import { BRAND, buildAvailability, localDate, getService, type BookedJob, type Contractor } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";
import { zipCentroid } from "@/lib/geo";
import { openFor } from "@/lib/launch";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("service") ?? "";
  const zip = (url.searchParams.get("zip") ?? "").slice(0, 5);
  const svc = getService(slug);
  const includeToday = url.searchParams.get("today") === "1" && !svc?.leadDays;
  if (!svc || !/^\d{5}$/.test(zip)) return Response.json({ error: "service and 5-digit zip required" }, { status: 400 });

  // constraint-driven launch: services not open yet in this city → "coming soon" + waitlist
  const launch = await openFor(svc.slug, zip);
  if (!launch.open) return Response.json({ mode: "closed", market: launch.market, pros: 0, days: [] }, { headers: { "Cache-Control": "private, max-age=60" } });

  let contractors: Contractor[] = [];
  let jobs: BookedJob[] = [];
  let loc: { lat: number; lng: number } | null = null;
  if (supabaseConfigured && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const db = adminClient();
    const from = includeToday ? localDate() : new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const to = new Date(Date.now() + (BRAND.bookingHorizonDays + 1) * 86400000).toISOString().slice(0, 10);
    const sameTrade = (await db.from("services").select("slug")).data?.map((r: { slug: string }) => r.slug).filter((s: string) => getService(s)?.trades.some((t) => svc.trades.includes(t))) ?? [svc.slug];
    const [{ data: pros }, { data: booked }, { data: waiting }] = await Promise.all([
      db.from("contractors").select("*").eq("status", "approved"),
      db.from("jobs").select("contractor_id, scheduled_date, time_window").gte("scheduled_date", from).lte("scheduled_date", to).not("contractor_id", "is", null).neq("status", "cancelled"),
      // paid work in this area and trade that doesn't have a pro yet
      db.from("jobs").select("contractor_id, scheduled_date, time_window").gte("scheduled_date", from).lte("scheduled_date", to).is("contractor_id", null)
        .not("paid_at", "is", null).in("status", ["scheduled", "dispatched"]).in("service_slug", sameTrade).like("zip", `${zip.slice(0, 3)}%`),
    ]);
    contractors = (pros ?? []) as Contractor[];
    loc = await zipCentroid(zip);
    jobs = [...((booked ?? []) as BookedJob[]), ...((waiting ?? []) as BookedJob[])];
  }
  const result = buildAvailability({ slug: svc.slug, zip, contractors, jobs, lat: loc?.lat, lng: loc?.lng, includeToday });
  return Response.json(result, { headers: { "Cache-Control": "private, max-age=60" } });
}
