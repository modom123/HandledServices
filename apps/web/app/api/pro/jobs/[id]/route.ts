/*
 * FILE    : apps/web/app/api/pro/jobs/[id]/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Pro: start a job, or complete it with photos (triggers AI QA).
 */
import { after } from "next/server";
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { completeJob, runQa, startJob } from "@/lib/jobs";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("complete"), photos: z.array(z.string()).min(1).max(12), note: z.string().max(2000).nullable().optional() }),
]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const { id } = await ctx.params;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return deny(400, "Completion needs at least one photo");
  if (body.data.action === "start") return Response.json({ ok: await startJob(id, v.contractorId) });
  const photos = body.data.photos.filter((p) => p.startsWith(`pro/${v.contractorId}/`));
  if (!photos.length) return deny(400, "Upload completion photos first");
  const ok = await completeJob(id, v.contractorId, photos, body.data.note ?? null);
  if (ok) after(() => runQa(id, body.data.action === "complete" ? body.data.note ?? null : null).catch((e) => console.error("[qa]", e)));
  return Response.json({ ok });
}
