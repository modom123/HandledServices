/*
 * FILE    : apps/web/app/api/pro/status/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_0255 UTC
 * PURPOSE : Pro: switch "On call" on (ready for same-day work, for 1–14 hours) or off.
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { setOnCall } from "@/lib/roster";

const Body = z.object({ on_call: z.boolean(), hours: z.coerce.number().min(1).max(14).optional() });

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const b = Body.safeParse(await req.json().catch(() => ({})));
  if (!b.success) return deny(400, "Send on_call true or false");
  return Response.json(await setOnCall(v.contractorId, b.data.on_call, b.data.hours));
}
