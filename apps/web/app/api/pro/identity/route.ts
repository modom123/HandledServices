/*
 * FILE    : apps/web/app/api/pro/identity/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-04_1934 UTC
 * PURPOSE : Pro starts the photo ID check: returns Stripe Identity's link, or { manual: true } when we'll
 *           verify on a short video call instead.
 * UPDATED : 2026-10-27_2300 UTC — owner only: an office manager (lib/pro-team.ts) can't do this.
 */
import { deny, getViewer, ownerOnly } from "@/lib/auth";
import { startIdCheck } from "@/lib/identity";

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const notOwner = ownerOnly(v);
  if (notOwner) return notOwner;
  return Response.json(await startIdCheck(v.contractorId));
}
