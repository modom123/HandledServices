/*
 * FILE    : apps/web/app/hub/map/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-11-10_0415 UTC
 * PURPOSE : Hub → Pros & recruiting → Coverage map: loads pros and markets; the map and tables are
 *           components/hub-views/CoverageMapView.tsx (US map of pros, service radiuses, open markets and service gaps).
 */
import { adminClient } from "@/lib/supabase/server";
import CoverageMapView, { type Market, type Pro } from "@/components/hub-views/CoverageMapView";

export const metadata = { title: "Coverage map" };
export const dynamic = "force-dynamic";

export default async function CoverageMap({ searchParams }: { searchParams: Promise<{ service?: string; status?: string; state?: string }> }) {
  const q = await searchParams;
  const db = adminClient();
  const [{ data: proRows }, { data: marketRows }] = await Promise.all([
    db.from("contractors").select("id, business_name, status, trades, base_lat, base_lng, base_zip, base_state, base_city, service_radius_mi").in("status", ["approved", "vetting", "applied"]).limit(5000),
    db.from("markets").select("id, name, state, active, launch_services").limit(500),
  ]);
  return <CoverageMapView q={q} proRows={(proRows ?? []) as Pro[]} marketRows={(marketRows ?? []) as Market[]} />;
}
