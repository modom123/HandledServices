/*
 * FILE    : apps/web/app/api/quote-requests/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0200 UTC
 * PURPOSE : Request-a-quote (public): the customer's big job goes to up to 3 nearby pros. Returns the customer's private
 *           quotes link token. Rate limited.
 */
import { z } from "zod";
import { getService, isPhotoPath } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { createQuoteRequest } from "@/lib/quotes";

const Body = z.object({
  contact_name: z.string().trim().min(2).max(120),
  contact_email: z.string().trim().email().max(200),
  contact_phone: z.string().trim().max(30).nullable().optional(),
  service_slug: z.string().max(80),
  description: z.string().trim().min(20, "Describe the job in a sentence or two").max(4000),
  zip: z.string().regex(/^\d{5}$/),
  city: z.string().trim().max(80).nullable().optional(),
  preferred_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  photos: z.array(z.string().refine(isPhotoPath)).max(8).default([]),
});

export async function POST(req: Request) {
  const limited = await rateLimit(req, "form");
  if (limited) return limited;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success || !getService(b.data.service_slug)) return Response.json({ error: b.success ? "Pick a service" : b.error.issues[0]?.message ?? "Check the form" }, { status: 400 });
  const v = await getViewer(req).catch(() => null);
  const r = await createQuoteRequest({ ...b.data, contact_phone: b.data.contact_phone || null, city: b.data.city || null, preferred_date: b.data.preferred_date || null }, v?.userId ?? null);
  return r.ok ? Response.json({ ok: true, token: r.token, invited: r.invited }) : Response.json({ error: r.error }, { status: 500 });
}
