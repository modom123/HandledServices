/*
 * FILE    : apps/web/app/api/hub/biz-leads/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-04_1934 UTC
 * PURPOSE : Staff controls for the business sales engine. POST JSON:
 *             { action: "settings", enabled, discover_per_day, emails_per_day, segments[], pilot_pct, pilot_jobs }
 *             { action: "status", id, status, note? }   — call list outcomes, not interested, do not contact
 *             { action: "run" }                         — run the engine now
 */
import { z } from "zod";
import { BIZ_SEGMENTS, BUSINESS_TERMS } from "@handled/core";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { bizLeadEngine, setBizLeadStatus } from "@/lib/biz-leads";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("settings"), enabled: z.boolean(), discover_per_day: z.number().int().min(0).max(25), emails_per_day: z.number().int().min(0).max(100),
    segments: z.array(z.string()).refine((a) => a.every((x) => x in BIZ_SEGMENTS)), pilot_pct: z.number().int().min(0).max(BUSINESS_TERMS.maxPilotPct), pilot_jobs: z.number().int().min(0).max(BUSINESS_TERMS.maxPilotJobs) }),
  z.object({ action: z.literal("status"), id: z.string().uuid(), status: z.enum(["call", "not_interested", "do_not_contact", "replied", "queued"]), note: z.string().max(1000).nullable().optional() }),
  z.object({ action: z.literal("run") }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check the request");
  const d = b.data;
  if (d.action === "settings") {
    const { action: _a, ...row } = d;
    const { error } = await adminClient().from("biz_lead_settings").upsert({ id: 1, ...row, updated_at: new Date().toISOString(), updated_by: v!.email });
    return error ? deny(500, error.message) : Response.json({ ok: true });
  }
  if (d.action === "status") { await setBizLeadStatus(d.id, d.status, d.note ?? null, v!.email); return Response.json({ ok: true }); }
  return Response.json({ ok: true, result: await bizLeadEngine() });
}
