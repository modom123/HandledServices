/*
 * FILE    : apps/web/app/api/pro/location/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_0255 UTC
 * PURPOSE : Pro app: share the phone's location — accepted only while on call or on a job today.
 * UPDATED : 2026-10-27_2300 UTC — office managers' locations are ignored (only the owner's phone counts).
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { recordLocation } from "@/lib/roster";

const Body = z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) });

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  if (v.proRole === "office") return Response.json({ ok: true, skipped: "office" }); // the office's phone isn't on the road
  const b = Body.safeParse(await req.json().catch(() => ({})));
  if (!b.success) return deny(400, "Bad location");
  const r = await recordLocation(v.contractorId, b.data.lat, b.data.lng);
  return r.ok ? Response.json(r) : deny(409, r.error);
}
