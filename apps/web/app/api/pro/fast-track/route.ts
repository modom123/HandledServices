/*
 * FILE    : apps/web/app/api/pro/fast-track/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_1311 UTC
 * PURPOSE : Pro applies for the proven-skill fast track. POST JSON { years, summary, references, trades[], photos[] }
 *           (photos are paths from /api/uploads).
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { applyFastTrack } from "@/lib/fast-track";

const Body = z.object({ years: z.number().int().min(0).max(70), summary: z.string().max(3000), references: z.string().max(1000).default(""), trades: z.array(z.string()).max(10).default([]), photos: z.array(z.string()).max(10) });

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check the form");
  const r = await applyFastTrack(v.contractorId, b.data);
  return Response.json(r, { status: r.ok ? 200 : 409 });
}
