/*
 * FILE    : apps/web/app/api/pro/calendar/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-12_0005 UTC
 * PURPOSE : Pro: my calendar sync link. GET — the feed links (created the first time). POST { rotate: true } — a new
 *           link; the old one stops working (use it if the link was shared by mistake).
 */
import { deny, getViewer } from "@/lib/auth";
import { calendarLinks } from "@/lib/pro-calendar";

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const l = await calendarLinks(v.contractorId);
  return l ? Response.json(l) : deny(503, "Calendar sync isn't switched on yet");
}

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const l = await calendarLinks(v.contractorId, true);
  return l ? Response.json(l) : deny(503, "Calendar sync isn't switched on yet");
}
