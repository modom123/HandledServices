/*
 * FILE    : apps/web/app/api/pro/board-alerts/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-12_2100 UTC
 * PURPOSE : Pro: choose job board alerts — "all" (instant for name-your-price posts and top pay, plus a daily summary),
 *           "digest" (daily summary only) or "off". Direct job offers are not affected. (lib/board setBoardAlerts)
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { setBoardAlerts } from "@/lib/board";

const Body = z.object({ pref: z.enum(["all", "digest", "off"]) });

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const b = Body.safeParse(await req.json().catch(() => ({})));
  if (!b.success) return deny(400, "Choose all, digest or off");
  const r = await setBoardAlerts(v.contractorId, b.data.pref);
  return Response.json(r, { status: r.ok ? 200 : 503 });
}
