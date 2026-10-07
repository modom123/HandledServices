/*
 * FILE    : apps/web/app/api/account/jobs/[id]/track/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : Customer: where's my pro? Distance + ETA while they're on the way (today only).
 */
import type { Job } from "@handled/core";
import { deny, getViewer } from "@/lib/auth";
import { trackPro } from "@/lib/visit";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in first");
  const { data } = await v.db.from("jobs").select("*").eq("id", (await params).id).eq("customer_id", v.userId).maybeSingle(); // the customer only (RLS also lets the pro read it)
  if (!data) return deny(404, "Not found");
  return Response.json(await trackPro(data as Job), { headers: { "Cache-Control": "no-store" } });
}
