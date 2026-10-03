/*
 * FILE    : apps/web/app/api/pro/fast-track/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_1311 UTC
 * PURPOSE : Pro applies for the proven-skill fast track. POST JSON { years, summary, references, trades[], photos[] }
 *           (photos are paths from /api/uploads).
 * UPDATED : 2026-10-03_1337 UTC — GET for the mobile app: where the pro's application stands.
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { applyFastTrack } from "@/lib/fast-track";
import { adminClient } from "@/lib/supabase/server";
import { proTier } from "@handled/core";

const Body = z.object({ years: z.number().int().min(0).max(70), summary: z.string().max(3000), references: z.string().max(1000).default(""), trades: z.array(z.string()).max(10).default([]), photos: z.array(z.string()).max(10) });

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check the form");
  const r = await applyFastTrack(v.contractorId, b.data);
  return Response.json(r, { status: r.ok ? 200 : 409 });
}

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const { data: c } = await adminClient().from("contractors").select("trades, jobs_completed, rating, on_time_rate, tier_floor, fast_track_status, fast_track_note").eq("id", v.contractorId).single();
  if (!c) return deny(404, "Pro not found");
  return Response.json({ status: c.fast_track_status ?? "none", note: c.fast_track_note ?? null, trades: c.trades ?? [], tier: proTier(c).id });
}
