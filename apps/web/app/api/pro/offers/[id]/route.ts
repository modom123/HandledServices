/*
 * FILE    : apps/web/app/api/pro/offers/[id]/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Pro: accept or decline a job offer (web portal + mobile app).
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { acceptOffer, declineOffer } from "@/lib/jobs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const { id } = await ctx.params;
  const body = z.object({ action: z.enum(["accept", "decline"]) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return deny(400, "action required");
  const result = body.data.action === "accept" ? await acceptOffer(id, v.contractorId) : await declineOffer(id, v.contractorId);
  return Response.json(result, { status: result.ok ? 200 : 409 });
}
