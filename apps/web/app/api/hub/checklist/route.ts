/*
 * FILE    : apps/web/app/api/hub/checklist/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1346 UTC
 * PURPOSE : Staff: tick / untick a business & legal launch item, with an optional note.
 */
import { z } from "zod";
import { LAUNCH_CHECKLIST } from "@handled/core";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";

const Body = z.object({ key: z.string(), done: z.boolean(), note: z.string().max(500).optional() });

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny(403, "Staff only");
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success || !LAUNCH_CHECKLIST.some((i) => i.key === b.data.key)) return deny(400, "Unknown item");
  const { error } = await adminClient().from("launch_checklist").upsert({
    key: b.data.key, done_at: b.data.done ? new Date().toISOString() : null, done_by: b.data.done ? v!.fullName ?? v!.email : null,
    ...(b.data.note !== undefined ? { note: b.data.note || null } : {}), updated_at: new Date().toISOString(),
  });
  return error ? deny(500, error.message) : Response.json({ ok: true });
}
