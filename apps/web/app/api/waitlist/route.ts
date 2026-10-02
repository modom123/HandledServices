/*
 * FILE    : apps/web/app/api/waitlist/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_2243 UTC
 * PURPOSE : Join the waitlist for a service in a ZIP we don't cover yet (web booking calendar
 *           and the app). POST { email, phone?, name?, zip, service, locale? }. We email/text them
 *           the day a pro covers it (daily sweep → notifyWaitlist).
 */
import { z } from "zod";
import { getService } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { joinWaitlist } from "@/lib/waitlist";
import { supabaseConfigured } from "@/lib/supabase/env";

const Body = z.object({
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(30).optional().nullable(),
  name: z.string().trim().max(100).optional().nullable(),
  zip: z.string().regex(/^\d{5}$/),
  service: z.string().max(80),
  locale: z.enum(["en", "es"]).optional(),
  source: z.string().max(40).optional(),
});

export async function POST(req: Request) {
  const limited = await rateLimit(req, "form");
  if (limited) return limited;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success || !getService(b.data.service)) return Response.json({ error: "Enter a valid email and 5-digit ZIP" }, { status: 400 });
  if (!supabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: "Not available right now" }, { status: 503 });
  const v = await getViewer(req).catch(() => null);
  try {
    await joinWaitlist({ email: b.data.email, phone: b.data.phone || null, name: b.data.name || null, zip: b.data.zip, service_slug: b.data.service, locale: b.data.locale ?? "en", profile_id: v?.userId ?? null, source: b.data.source ?? "booking" });
  } catch (e) {
    console.error("[waitlist]", e);
    return Response.json({ error: "Couldn't save — try again" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
