/*
 * FILE    : apps/web/app/api/snap/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_0449 UTC
 * PURPOSE : "Snap & post a job" (web + app): POST { photos[] (uploaded via /api/uploads), note?, locale } → the service
 *           the photos show and its job details, filled in (lib/ai/identify.ts). No login needed; rate limited.
 *           Without the AI configured, it answers { service_slug: null } and the customer picks the service.
 * UPDATED : 2026-10-06_0726 UTC — security: photo paths checked with isPhotoPath.
 */
import { z } from "zod";
import { aiIdentifyJob } from "@/lib/ai/identify";
import { aiEnabled } from "@/lib/ai/client";
import { signedUrls } from "@/lib/photos";
import { rateLimit } from "@/lib/ratelimit";
import { isPhotoPath } from "@handled/core";

const Body = z.object({
  photos: z.array(z.string().refine(isPhotoPath, "Bad photo")).max(8).default([]),
  note: z.string().max(500).nullable().optional(),
  locale: z.enum(["en", "es"]).default("en"),
});

export async function POST(req: Request) {
  const limited = await rateLimit(req, "ai_quote");
  if (limited) return limited;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success || (!b.data.photos.length && !b.data.note?.trim())) return Response.json({ ok: false, error: "Add a photo or tell us what you need" }, { status: 400 });
  if (!aiEnabled()) return Response.json({ ok: true, service_slug: null, alternatives: [], summary: null, answers: {}, notes: null, ai: false });
  const r = await aiIdentifyJob({ photoUrls: await signedUrls(b.data.photos), note: b.data.note, locale: b.data.locale }).catch(() => null);
  return Response.json({ ok: true, ai: true, ...(r ?? { service_slug: null, alternatives: [], summary: null, answers: {}, notes: null }) });
}
