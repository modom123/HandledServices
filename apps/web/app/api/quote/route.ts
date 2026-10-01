/*
 * FILE    : apps/web/app/api/quote/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Instant quote. Deterministic estimate always; AI review when notes are present.
 */
import { z } from "zod";
import { getService, isRush } from "@handled/core";
import { aiQuote } from "@/lib/ai/quote";
import { signedUrls } from "@/lib/photos";

const Body = z.object({
  service_slug: z.string(),
  answers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  frequency: z.enum(["once", "weekly", "biweekly", "monthly", "quarterly"]).default("once"),
  scheduled_date: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  photos: z.array(z.string().startsWith("booking/")).max(8).default([]),
  ai: z.boolean().default(false),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !getService(parsed.data.service_slug)) return Response.json({ error: "Invalid request" }, { status: 400 });
  const b = parsed.data;
  const { baseline, ai } = await aiQuote({
    slug: b.service_slug,
    answers: b.answers,
    frequency: b.frequency,
    notes: b.ai ? b.notes : null, // AI review only when the customer asks for it on the review step
    photoUrls: b.ai ? await signedUrls(b.photos) : [],
    rush: isRush(b.scheduled_date),
  });
  return Response.json({ baseline, ai });
}
