/*
 * FILE    : apps/web/app/api/availability/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2115 UTC
 * PURPOSE : Booking calendar: open / limited / full for each day and arrival window over
 *           the booking horizon, from real pro capacity in the customer's ZIP.
 *           GET /api/availability?service=house-cleaning&zip=48201
 */
import { BRAND, buildAvailability, getService, type BookedJob, type Contractor } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("service") ?? "";
  const zip = (url.searchParams.get("zip") ?? "").slice(0, 5);
  const svc = getService(slug);
  if (!svc || !/^\d{5}$/.test(zip)) return Response.json({ error: "service and 5-digit zip required" }, { status: 400 });

  let contractors: Contractor[] = [];
  let jobs: BookedJob[] = [];
  if (supabaseConfigured && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const db = adminClient();
    const from = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
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
    jobs = [...((booked ?? []) as BookedJob[]), ...((waiting ?? []) as BookedJob[])];
  }
  const result = buildAvailability({ slug: svc.slug, zip, contractors, jobs });
  return Response.json(result, { headers: { "Cache-Control": "private, max-age=60" } });
}
