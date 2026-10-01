/*
 * FILE    : apps/web/app/api/hub/alerts/[id]/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Staff: resolve an ops alert.
 */
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const { id } = await ctx.params;
  await adminClient().from("ops_alerts").update({ resolved: true }).eq("id", id);
  return Response.json({ ok: true });
}
