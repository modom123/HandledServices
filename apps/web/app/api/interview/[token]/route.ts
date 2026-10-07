/*
 * FILE    : apps/web/app/api/interview/[token]/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_0246 UTC
 * PURPOSE : The candidate's side of the AI screening interview (private link, no login).
 *             GET                                        — status and transcript
 *             POST { action: "consent", locale }         — agrees to the AI interview → first question
 *             POST { action: "message", text }           — an answer → the next question (or the close)
 *             POST { action: "person" }                  — would rather talk to a person
 */
import { z } from "zod";
import { candidateMessage, consent, interviewByToken, requestPerson } from "@/lib/interviews";
import { rateLimit } from "@/lib/ratelimit";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("consent"), locale: z.enum(["en", "es"]).default("en") }),
  z.object({ action: z.literal("message"), text: z.string().min(1).max(2000) }),
  z.object({ action: z.literal("person") }),
]);

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const s = await interviewByToken((await ctx.params).token);
  if (!s) return Response.json({ ok: false, error: "Link not found" }, { status: 404 });
  return Response.json({ ok: true, status: s.iv.status, locale: s.iv.locale, transcript: s.iv.transcript.map(({ role, text, at }) => ({ role, text, at })), firstName: s.firstName });
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const limited = await rateLimit(req, "interview", token);
  if (limited) return limited;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return Response.json({ ok: false, error: "Check the request" }, { status: 400 });
  const r = b.data.action === "consent" ? await consent(token, b.data.locale) : b.data.action === "message" ? await candidateMessage(token, b.data.text) : await requestPerson(token);
  const out = r as { ok: boolean; transcript?: { role: string; text: string; at: string }[] };
  return Response.json({ ...r, ...(out.transcript ? { transcript: out.transcript.map(({ role, text, at }) => ({ role, text, at })) } : {}) }, { status: r.ok ? 200 : 409 });
}
