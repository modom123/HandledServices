/*
 * FILE    : apps/web/app/api/call-slots/ics/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_1530 UTC
 * PURPOSE : "Add to calendar" (Apple / Outlook) for a booked call: GET ?at=<ISO>&m=<minutes> → an .ics file with a
 *           15-minute reminder. Holds only the time and our name (no personal data), so it needs no login.
 */
import { callCalendarLinks } from "@handled/core";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const at = u.searchParams.get("at") ?? "";
  const m = Math.min(120, Math.max(10, Number(u.searchParams.get("m")) || 30));
  if (!Number.isFinite(Date.parse(at))) return new Response("Bad time", { status: 400 });
  const { ics } = callCalendarLinks({ at, minutes: m });
  return new Response(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="handled-call.ics"' } });
}
