/*
 * FILE    : apps/web/app/api/pro/offers/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-06_1900 UTC
 * PURPOSE : GET — the signed-in pro's open offers (need-to-know, lib/job-access): each job as the pro may see it and
 *           `pro_pay`, their NET pay. Replaces the app's direct database read of job_offers.
 */
import { deny, getViewer } from "@/lib/auth";
import { proOffers } from "@/lib/job-access";

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  return Response.json({ offers: await proOffers(v.contractorId) }, { headers: { "Cache-Control": "no-store" } });
}
