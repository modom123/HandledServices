/*
 * FILE    : apps/web/app/api/hub/contractors/[id]/pin/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-13_0030 UTC
 * PURPOSE : Staff: reset a pro's PIN (lib/pro-pin.ts staffResetPin). The pro creates a new one the next time they open
 *           an accepted job. Use it when a pro is locked out, or if their phone may be in someone else's hands.
 */
import { deny, getViewer, isStaff } from "@/lib/auth";
import { staffResetPin } from "@/lib/pro-pin";
import { logRecruiting } from "@/lib/recruiting";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const { id } = await ctx.params;
  const r = await staffResetPin(id);
  if (r.ok) await logRecruiting("pin_reset", { contractorId: id }, "Pro PIN reset by staff", v!.fullName ?? v!.email).catch(() => {});
  return Response.json(r, { status: r.ok ? 200 : 503 });
}
