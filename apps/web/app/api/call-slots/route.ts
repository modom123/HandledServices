/*
 * FILE    : apps/web/app/api/call-slots/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_1530 UTC
 * PURPOSE : GET → the open times a customer can book for a Handled person to call them (Post your project and the AI
 *           project manager): { tz, slotMinutes, days: [{ date, slots: [{ at, left }] }] }. Public, no login, no
 *           personal data. Booking itself goes with the lead (/api/leads/web, call_at), re-checked there.
 */
import { openCallSlots } from "@/lib/call-schedule";

export const dynamic = "force-dynamic";

export async function GET() {
  const { hours, days } = await openCallSlots();
  return Response.json({ tz: hours.tz, slotMinutes: hours.slotMinutes, days }, { headers: { "Cache-Control": "no-store" } });
}
