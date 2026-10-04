/*
 * FILE    : apps/web/app/api/pro/identity/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-04_1934 UTC
 * PURPOSE : Pro starts the photo ID check: returns Stripe Identity's link, or { manual: true } when we'll
 *           verify on a short video call instead.
 */
import { deny, getViewer } from "@/lib/auth";
import { startIdCheck } from "@/lib/identity";

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  return Response.json(await startIdCheck(v.contractorId));
}
