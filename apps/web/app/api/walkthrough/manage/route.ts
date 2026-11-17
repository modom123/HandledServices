/*
 * FILE    : apps/web/app/api/walkthrough/manage/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2350 UTC
 * PURPOSE : The business's own manage link (/walkthrough/<token>), public with the private token:
 *             POST { token, action: "reschedule", start } | { token, action: "cancel", reason? }
 */
import { z } from "zod";
import { rateLimit } from "@/lib/ratelimit";
import { cancelByToken, rescheduleByToken } from "@/lib/walkthroughs";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reschedule"), token: z.string().regex(/^[a-f0-9]{24,40}$/), start: z.string().datetime({ offset: true }) }),
  z.object({ action: z.literal("cancel"), token: z.string().regex(/^[a-f0-9]{24,40}$/), reason: z.string().trim().max(500).nullable().optional() }),
]);

export async function POST(req: Request) {
  const limited = await rateLimit(req, "form");
  if (limited) return limited;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return Response.json({ error: "Check the request" }, { status: 400 });
  const r = b.data.action === "reschedule" ? await rescheduleByToken(b.data.token, b.data.start) : await cancelByToken(b.data.token, b.data.reason ?? null);
  return Response.json(r, { status: r.ok ? 200 : 409 });
}
