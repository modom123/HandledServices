/*
 * FILE    : apps/web/app/api/concierge/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0316 UTC — per-IP abuse limit (lib/ratelimit).
 * PURPOSE : AI concierge chat endpoint (website widget + mobile).
 * UPDATED : 2026-11-17_1446 UTC — optional `project` (a project posted on /post): the chat runs as its AI project manager.
 */
import { z } from "zod";
import { conciergeReply } from "@/lib/ai/concierge";
import { rateLimit } from "@/lib/ratelimit";

const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) })).min(1).max(30),
  project: z.object({
    service_slug: z.string().max(80).nullable().optional(),
    details: z.string().max(2500).nullable().optional(),
    zip: z.string().max(10).nullable().optional(),
    when: z.string().max(40).nullable().optional(),
    budget: z.string().max(40).nullable().optional(),
    answers: z.record(z.string().max(60), z.union([z.string().max(200), z.number(), z.boolean()])).optional(),
  }).nullable().optional(),
});

export async function POST(req: Request) {
  const limited = await rateLimit(req, "concierge");
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.messages.at(-1)?.role !== "user") return Response.json({ error: "Invalid chat" }, { status: 400 });
  return Response.json({ reply: await conciergeReply(parsed.data.messages, parsed.data.project) });
}
