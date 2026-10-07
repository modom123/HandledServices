/*
 * FILE    : apps/web/app/api/hub/crew/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_1311 UTC
 * PURPOSE : Staff: record a crew member's background-check result when it was run by hand (no Checkr key),
 *           or re-order it. POST { id, background_status: clear | consider | pending } | { id, action: "reorder" }.
 */
import { z } from "zod";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { orderCrewCheck, setCrewBackground } from "@/lib/crew";

const Body = z.union([
  z.object({ id: z.string().uuid(), background_status: z.enum(["clear", "consider", "pending"]) }),
  z.object({ id: z.string().uuid(), action: z.literal("reorder") }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check the request");
  if ("action" in b.data) {
    await adminClient().from("crew_members").update({ background_status: "not_started" }).eq("id", b.data.id);
    await orderCrewCheck(b.data.id);
  } else await setCrewBackground(b.data.id, b.data.background_status, v!.email ?? "staff");
  return Response.json({ ok: true });
}
