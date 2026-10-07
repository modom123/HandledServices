/*
 * FILE    : apps/web/app/api/pro/deductions/[id]/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_0120 UTC
 * PURPOSE : A pro answers a proposed deduction (web portal + app). POST { response }.
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { respondToDeduction } from "@/lib/deductions";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(401, "Pro account required");
  const b = z.object({ response: z.string().trim().min(5).max(4000) }).safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Write a few words about what happened");
  const r = await respondToDeduction((await ctx.params).id, v.contractorId, b.data.response);
  return r.ok ? Response.json(r) : deny(409, r.error);
}
