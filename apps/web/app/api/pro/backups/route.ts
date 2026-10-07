/*
 * FILE    : apps/web/app/api/pro/backups/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-06_1950 UTC
 * PURPOSE : Pro answers a standby request (backup #1–#3 on someone else's job). POST { id, answer: "yes" | "no" }.
 *           GET lists the pro's open standby requests (for the app). Passing is always free.
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { answerStandby, standbyFor } from "@/lib/coverage";

const Body = z.object({ id: z.string().uuid(), answer: z.enum(["yes", "no"]) });

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  return Response.json({ ok: true, standby: await standbyFor(v.contractorId) });
}

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check the request");
  const r = await answerStandby(b.data.id, v.contractorId, b.data.answer === "yes");
  return Response.json(r, { status: r.ok ? 200 : 409 });
}
