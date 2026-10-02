/*
 * FILE    : apps/web/app/api/concierge/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0316 UTC — per-IP abuse limit (lib/ratelimit).
 * PURPOSE : AI concierge chat endpoint (website widget + mobile).
 */
import { z } from "zod";
import { conciergeReply } from "@/lib/ai/concierge";
import { rateLimit } from "@/lib/ratelimit";

const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) })).min(1).max(30),
});

export async function POST(req: Request) {
  const limited = await rateLimit(req, "concierge");
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.messages.at(-1)?.role !== "user") return Response.json({ error: "Invalid chat" }, { status: 400 });
  return Response.json({ reply: await conciergeReply(parsed.data.messages) });
}
