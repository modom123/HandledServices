/*
 * FILE    : apps/web/app/api/pro/calendar/[token]/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-12_0005 UTC
 * PURPOSE : A pro's calendar feed (text/calendar) for Google / Apple / Outlook subscriptions. The secret token in the URL
 *           is the only key (calendar apps can't sign in); the pro can regenerate it from My calendar. No entry details.
 */
import { calendarFeed } from "@/lib/pro-calendar";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const ics = await calendarFeed(token.replace(/\.ics$/, ""));
  if (!ics) return new Response("Not found", { status: 404 });
  return new Response(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="handled-jobs.ics"', "Cache-Control": "private, max-age=900" } });
}
