/*
 * FILE    : apps/web/app/api/hub/payouts/[id]/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Staff: mark a payout paid or hold it.
 */
import { z } from "zod";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const body = z.object({ status: z.enum(["paid", "held", "approved"]) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return deny(400, "status required");
  const { id } = await ctx.params;
  await adminClient().from("payouts").update({ status: body.data.status, paid_at: body.data.status === "paid" ? new Date().toISOString() : null }).eq("id", id);
  return Response.json({ ok: true });
}
