/*
 * FILE    : apps/web/app/api/hub/inbox/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0100 UTC
 * PURPOSE : Staff controls for the Lead inbox. POST JSON { action: "status", id, status: new|contacted|booked|lost|spam }.
 */
import { z } from "zod";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { setLeadStatus } from "@/lib/lead-intake";

const Body = z.object({ action: z.literal("status"), id: z.string().uuid(), status: z.enum(["new", "contacted", "booked", "lost", "spam"]) });

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check the request");
  await setLeadStatus(b.data.id, b.data.status, v!.email ?? "staff");
  return Response.json({ ok: true });
}
