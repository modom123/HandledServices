/*
 * FILE    : apps/web/app/api/hub/walkthroughs/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2350 UTC
 * PURPOSE : Hub → Walkthroughs. POST JSON:
 *             { action: "update", id, status?, staff_notes?, assigned_to?, follow_up? }   — any staff
 *             { action: "settings", enabled, days[], start_min, end_min, slot_minutes, per_slot, lead_hours, horizon_days, time_zone, notify_emails? } — admins
 */
import { z } from "zod";
import { ADMINS_ONLY, deny, getViewer, isAdmin, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { setWalkthroughStatus } from "@/lib/walkthroughs";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update"), id: z.string().uuid(), status: z.enum(["booked", "done", "no_show", "cancelled"]).optional(), staff_notes: z.string().max(4000).nullable().optional(), assigned_to: z.string().max(120).nullable().optional(), follow_up: z.boolean().optional() }),
  z.object({ action: z.literal("settings"), enabled: z.boolean(), days: z.array(z.number().int().min(0).max(6)).max(7), start_min: z.number().int().min(0).max(1439), end_min: z.number().int().min(1).max(1440),
    slot_minutes: z.number().int().min(10).max(240), per_slot: z.number().int().min(1).max(20), lead_hours: z.number().int().min(0).max(168), horizon_days: z.number().int().min(1).max(60),
    time_zone: z.enum(["America/Detroit", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles"]), notify_emails: z.string().max(500).nullable().optional() }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check the request");
  const d = b.data;
  if (d.action === "update") {
    const r = await setWalkthroughStatus(d.id, { status: d.status, staff_notes: d.staff_notes, assigned_to: d.assigned_to, followUp: d.follow_up }, v!.email ?? "staff");
    return Response.json(r, { status: r.ok ? 200 : 404 });
  }
  if (!isAdmin(v)) return deny(403, ADMINS_ONLY);
  if (d.end_min <= d.start_min) return deny(400, "End time must be after the start time");
  const { action: _a, ...row } = d;
  const { error } = await adminClient().from("walkthrough_settings").upsert({ id: 1, ...row, notify_emails: row.notify_emails || null, updated_at: new Date().toISOString(), updated_by: v!.email });
  return error ? deny(500, error.message) : Response.json({ ok: true });
}
