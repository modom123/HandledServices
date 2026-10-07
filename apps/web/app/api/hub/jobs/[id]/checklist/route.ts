/*
 * FILE    : apps/web/app/api/hub/jobs/[id]/checklist/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_0221 UTC
 * PURPOSE : Staff special instructions on one job's checklist (shown to the pro first, on the work order).
 *             POST { action: "add", text, required? } · { action: "remove", id }
 */
import { z } from "zod";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { addSpecial, removeSpecial } from "@/lib/checklists";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), text: z.string().min(3).max(300), required: z.boolean().optional() }),
  z.object({ action: z.literal("remove"), id: z.string().min(2).max(40) }),
]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const { id } = await ctx.params;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check the request");
  const r = b.data.action === "add" ? await addSpecial(id, b.data.text, "staff", b.data.required ?? true, v!.email) : await removeSpecial(id, b.data.id, "staff");
  return Response.json(r, { status: r.ok ? 200 : 409 });
}
