/*
 * FILE    : apps/web/app/api/hub/agent-actions/[id]/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_1800 UTC
 * PURPOSE : Staff: approve (execute) or reject an action proposed by an IEBC AI employee.
 */
import { z } from "zod";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { execute } from "@/lib/iebc/gateway";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const body = z.object({ decision: z.enum(["approve", "reject"]) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return deny(400, "decision required");
  const { id } = await ctx.params;
  const db = adminClient();
  // claim the row first so two staff can't execute the same action twice
  const { data: row } = await db.from("agent_actions")
    .update({ status: body.data.decision === "reject" ? "rejected" : "failed", decided_by: v!.fullName ?? v!.email, decided_at: new Date().toISOString() })
    .eq("id", id).eq("status", "pending_approval").select("*").maybeSingle();
  if (!row) return deny(409, "Already decided");
  if (body.data.decision === "reject") return Response.json({ status: "rejected" });
  const { data: agent } = await db.from("iebc_agents").select("name").eq("id", row.agent_id).maybeSingle();
  const out = await execute(row.action, row.params, async (status, result) => {
    await db.from("agent_actions").update({ status, result }).eq("id", id);
    return id;
  }, { actor: `${agent?.name ?? "IEBC agent"} (IEBC), approved by ${v!.fullName ?? v!.email}` });
  return Response.json(out);
}
