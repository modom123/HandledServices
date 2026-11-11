/*
 * FILE    : apps/web/app/api/pro/info/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-29_0715 UTC
 * PURPOSE : GET → the signed-in pro's "My info" for the app: profile, status, every onboarding step (done / left),
 *           orientation progress and documents with expiry dates. Same data as /pro/info on the web.
 */
import { TRADES, onboardingChecklist, orientationStatus, type Contractor } from "@handled/core";
import { deny, getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const db = adminClient();
  const [{ data }, { data: docs }] = await Promise.all([
    db.from("contractors").select("*").eq("id", v.contractorId).single(),
    db.from("contractor_documents").select("id, kind, status, expires_on, created_at").eq("contractor_id", v.contractorId).order("created_at", { ascending: false }).limit(50),
  ]);
  const c = data as (Contractor & Record<string, unknown>) | null;
  if (!c) return deny(404, "No pro account");
  const { steps, complete } = onboardingChecklist(c as never);
  return Response.json({
    profile: {
      business_name: c.business_name, contact_name: c.contact_name, email: c.email, phone: c.phone, pro_no: c.pro_no ?? null,
      trades: (c.trades ?? []).map((id) => TRADES.find((t) => t.id === id)?.label ?? id), base_city: c.base_city ?? null, base_zip: c.base_zip ?? null,
      radius: c.service_radius_mi ?? 25, insured_until: c.insured_until, license_number: c.license_number, license_expires: c.license_expires,
      id_verified_at: c.id_verified_at ?? null, background_checked: c.background_checked, payout_method: c.payout_method,
    },
    status: c.status, approved: c.status === "approved", complete,
    steps: steps.map((s) => ({ key: s.key, label: s.label, done: s.done, optional: Boolean(s.optional), expiring: Boolean(s.expiring), detail: s.detail })),
    orientation: orientationStatus(c.orientation as Record<string, string> | null),
    documents: docs ?? [],
  });
}
