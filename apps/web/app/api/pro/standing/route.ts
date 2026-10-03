/*
 * FILE    : apps/web/app/api/pro/standing/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0123 UTC
 * PURPOSE : A pro appeals a warning, suspension or deactivation (Pro Deactivation Policy).
 *           POST { appeal }. A person decides within 7 days.
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { appealStanding } from "@/lib/standing";

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(401, "Pro account required");
  const b = z.object({ appeal: z.string().trim().min(10).max(4000) }).safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Tell us in a few sentences why the decision should change");
  const r = await appealStanding(v.contractorId, b.data.appeal);
  return r.ok ? Response.json(r) : deny(409, r.error);
}
