/*
 * FILE    : apps/web/app/api/quote/save/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_0027 UTC
 * PURPOSE : "Email me this price" from the booking page. POST { email, service_slug, answers,
 *           frequency, locale } → emails the price (re-computed here) with a link back to the
 *           filled-in booking, then follow-ups on day 1 and 4 unless they book (lib/reminders).
 */
import { z } from "zod";
import { getService } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { saveQuote } from "@/lib/reminders";
import { supabaseConfigured } from "@/lib/supabase/env";

const Body = z.object({
  email: z.string().trim().email().max(200),
  service_slug: z.string().max(80),
  answers: z.record(z.string(), z.union([z.string().max(200), z.number(), z.boolean()])),
  frequency: z.enum(["once", "weekly", "biweekly", "monthly", "quarterly"]).default("once"),
  locale: z.enum(["en", "es"]).default("en"),
});

export async function POST(req: Request) {
  const limited = await rateLimit(req, "form");
  if (limited) return limited;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success || !getService(b.data.service_slug)) return Response.json({ error: "Enter a valid email" }, { status: 400 });
  if (!supabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: "Not available right now" }, { status: 503 });
  const v = await getViewer(req).catch(() => null);
  try {
    await saveQuote({ email: b.data.email, slug: b.data.service_slug, answers: b.data.answers, frequency: b.data.frequency, locale: b.data.locale, profileId: v?.userId ?? null });
  } catch (e) {
    console.error("[saved quote]", e);
    return Response.json({ error: "Couldn't save — try again" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
