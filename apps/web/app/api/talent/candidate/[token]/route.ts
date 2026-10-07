/*
 * FILE    : apps/web/app/api/talent/candidate/[token]/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_2034 UTC
 * PURPOSE : A candidate's link from "your résumé went to…": confirm, or withdraw (pulled right away, staff alerted).
 */
import { z } from "zod";
import { deny } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { candidateAnswer } from "@/lib/talent";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const limited = await rateLimit(req, "form");
  if (limited) return limited;
  const { token } = await params;
  const b = z.object({ answer: z.enum(["confirm", "withdraw"]) }).safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check the request");
  const r = await candidateAnswer(token, b.data.answer);
  return Response.json(r, { status: r.ok ? 200 : 400 });
}
