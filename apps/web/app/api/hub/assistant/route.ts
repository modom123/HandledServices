/*
 * FILE    : apps/web/app/api/hub/assistant/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Staff: AI operations assistant (tool-using agent over live data).
 */
import { z } from "zod";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { opsAssistant } from "@/lib/ai/ops-agent";

export const maxDuration = 120;

const Body = z.object({ messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) })).min(1).max(40) });

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return deny(400, "Invalid chat");
  try {
    return Response.json({ reply: await opsAssistant(parsed.data.messages, v!.fullName ?? v!.email) });
  } catch (e) {
    console.error("[ops-assistant]", e);
    return Response.json({ reply: "The assistant hit an error — check the logs." }, { status: 500 });
  }
}
