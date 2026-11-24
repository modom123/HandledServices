/*
 * FILE    : apps/web/app/api/post/estimate/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_1446 UTC
 * PURPOSE : "Post your project" instant estimate (/post): POST { service?, details?, zip?, photos[]?, locale } → the
 *           service, what the price assumes and a price range from the rules engine (lib/project-estimate.ts). No login
 *           and no contact details needed to see it; rate limited like the other AI price checks.
 */
import { z } from "zod";
import { isPhotoPath } from "@handled/core";
import { estimateProject } from "@/lib/project-estimate";
import { signedUrls } from "@/lib/photos";
import { rateLimit } from "@/lib/ratelimit";

const Body = z.object({
  service: z.string().max(80).nullable().optional(),
  details: z.string().max(2500).nullable().optional(),
  zip: z.string().max(10).nullable().optional(),
  photos: z.array(z.string().refine(isPhotoPath, "Bad photo")).max(8).default([]),
  locale: z.enum(["en", "es"]).default("en"),
});

export async function POST(req: Request) {
  const limited = await rateLimit(req, "ai_quote");
  if (limited) return limited;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success || (!b.data.service && (b.data.details?.trim().length ?? 0) < 10 && !b.data.photos.length)) {
    return Response.json({ ok: false, error: "Tell us what you need — pick a service or describe the project" }, { status: 400 });
  }
  const { photos, ...rest } = b.data;
  const r = await estimateProject({ ...rest, photoUrls: photos.length ? await signedUrls(photos) : [] }).catch((err) => { console.error("[post:estimate]", err); return null; });
  if (!r) return Response.json({ ok: false, error: "Couldn't price that right now — try again" }, { status: 500 });
  return Response.json({ ok: true, ...r });
}
