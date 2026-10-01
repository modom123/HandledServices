/*
 * FILE    : apps/web/app/api/hub/agents/[id]/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_1800 UTC
 * PURPOSE : Staff: change an IEBC agent's autonomy, scopes or pause it.
 */
import { z } from "zod";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";

const Patch = z.object({
  autonomy: z.enum(["suggest", "approval", "autonomous"]).optional(),
  active: z.boolean().optional(),
  scopes: z.array(z.enum(["read", "ops", "finance", "recruiting", "retention", "sales"])).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return deny(400, "Invalid update");
  const { id } = await ctx.params;
  const { error } = await adminClient().from("iebc_agents").update(parsed.data).eq("id", id);
  return error ? Response.json({ error: error.message }, { status: 500 }) : Response.json({ ok: true });
}
