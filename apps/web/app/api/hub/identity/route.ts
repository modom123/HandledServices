/*
 * FILE    : apps/web/app/api/hub/identity/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-04_1934 UTC
 * PURPOSE : Staff marks a pro's photo ID verified after a video call (ID next to their face, name matching the W-9).
 *           POST { contractor_id }.
 */
import { z } from "zod";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { idVerified } from "@/lib/identity";

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const b = z.object({ contractor_id: z.string().uuid() }).safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "contractor_id required");
  await idVerified(b.data.contractor_id, `staff:${v!.email} (video call)`);
  return Response.json({ ok: true });
}
