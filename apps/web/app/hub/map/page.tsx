/*
 * FILE    : apps/web/app/hub/map/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-11-10_0415 UTC
 * PURPOSE : Hub → Pros & recruiting → Coverage map: loads pros and markets; the map and tables are
 *           components/hub-views/CoverageMapView.tsx (US map of pros, service radiuses, open markets and service gaps).
 * UPDATED : 2026-11-10_0700 UTC — full pro records and prospects; the clicked state's depth chart goes to the view.
 */
import { depthChart, type Contractor } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import CoverageMapView, { type Market, type Pro } from "@/components/hub-views/CoverageMapView";

export const metadata = { title: "Coverage map" };
export const dynamic = "force-dynamic";

export default async function CoverageMap({ searchParams }: { searchParams: Promise<{ service?: string; status?: string; state?: string }> }) {
  const q = await searchParams;
  const db = adminClient();
  // full pro records: the depth chart needs insurance, license and background to know who is cleared
  const [{ data: proRows }, { data: marketRows }, apps] = await Promise.all([
    db.from("contractors").select("*").in("status", ["approved", "vetting", "applied"]).limit(5000),
    db.from("markets").select("id, name, state, active, launch_services").limit(500),
    db.from("contractor_applications").select("id, contact_name, business_name, trades, stage").in("stage", ["applied", "screened", "interviewing", "interviewed", "invited"]).limit(5000),
  ]);
  const state = /^[A-Za-z]{2}$/.test(q.state ?? "") ? q.state!.toUpperCase() : "";
  // the clicked state's depth chart: every service as a position, starter and backups from the pros there
  const depth = state ? depthChart({
    contractors: (proRows ?? []) as Contractor[], state,
    prospects: ((apps.error ? [] : apps.data) ?? []).map((a) => ({ id: String(a.id), name: String(a.business_name || a.contact_name), trades: (a.trades ?? []) as string[] })),
  }) : [];
  return <CoverageMapView q={q} proRows={(proRows ?? []) as Pro[]} marketRows={(marketRows ?? []) as Market[]} depth={depth} />;
}
