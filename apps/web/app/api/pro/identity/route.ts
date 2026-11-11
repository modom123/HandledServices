/*
 * FILE    : apps/web/app/api/pro/identity/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-04_1934 UTC
 * PURPOSE : Pro starts the photo ID check: returns Stripe Identity's link, or { manual: true } when we'll
 *           verify on a short video call instead.
 * UPDATED : 2026-11-06_0645 UTC — errors come back as a message the pro can read.
 */
import { deny, getViewer } from "@/lib/auth";
import { startIdCheck } from "@/lib/identity";

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  try {
    return Response.json(await startIdCheck(v.contractorId));
  } catch (e) {
    console.error("[pro identity]", e);
    return Response.json({ error: "We couldn't start the ID check. Please try again, or contact us and we'll verify you on a short video call." }, { status: 500 });
  }
}
