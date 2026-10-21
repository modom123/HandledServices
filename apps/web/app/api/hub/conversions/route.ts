/*
 * FILE    : apps/web/app/api/hub/conversions/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0100 UTC
 * PURPOSE : Google Ads offline conversions: GET → a CSV of bookings that came from a Google ad click (gclid), last 90
 *           days, in Google's upload format. Google Ads → Goals → Conversions → Uploads → upload this file (or schedule
 *           it). The conversion action's name must match GOOGLE_ADS_CONVERSION_NAME (default "Booking"). Staff only.
 */
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";

const csv = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const since = new Date(Date.now() - 90 * 86400000).toISOString();
  const { data } = await adminClient().from("jobs").select("ref, price_final, status, attribution, created_at").gte("created_at", since).neq("status", "cancelled").limit(20000);
  const name = process.env.GOOGLE_ADS_CONVERSION_NAME?.trim() || "Booking";
  const rows = (data ?? []).filter((j) => (j.attribution as Record<string, string> | null)?.gclid).map((j) => {
    const t = new Date(j.created_at).toISOString().replace("T", " ").slice(0, 19);
    return [(j.attribution as Record<string, string>).gclid, name, `${t}+0000`, Number(j.price_final ?? 0).toFixed(2), "USD", j.ref].map(csv).join(",");
  });
  const body = ["Parameters:TimeZone=+0000", "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency,Order ID", ...rows].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="google-ads-conversions_${new Date().toISOString().slice(0, 10)}.csv"` } });
}
