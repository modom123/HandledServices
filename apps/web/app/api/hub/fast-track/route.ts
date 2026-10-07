/*
 * FILE    : apps/web/app/api/hub/fast-track/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_1311 UTC
 * PURPOSE : Staff decides a fast-track application. POST { contractor_id, action: trial | approve | decline, note? }.
 */
import { z } from "zod";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { decideFastTrack } from "@/lib/fast-track";

const Body = z.object({ contractor_id: z.string().uuid(), action: z.enum(["trial", "approve", "decline"]), note: z.string().max(1000).nullable().optional() });

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check the request");
  const r = await decideFastTrack(b.data.contractor_id, b.data.action, b.data.note?.trim() || null, v!.email ?? "staff");
  return Response.json(r, { status: r.ok ? 200 : 409 });
}
