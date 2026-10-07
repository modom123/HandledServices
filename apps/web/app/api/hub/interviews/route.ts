/*
 * FILE    : apps/web/app/api/hub/interviews/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_0246 UTC
 * PURPOSE : Staff side of screening interviews (lib/interviews.ts). POST JSON:
 *             { action: "start", application_id, mode: "ai" | "human" }      — send the AI link / open a scorecard
 *             { action: "scorecard", application_id, scores[], answers{}, knockouts[], notes?, complete } — in person / phone
 *             { action: "finish", id }                                        — score an AI interview the candidate left early
 *             { action: "decide", id, decision: invite|follow_up|decline, reason? }
 */
import { z } from "zod";
import { COMPETENCIES } from "@handled/core";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { decideInterview, finishInterview, saveScorecard, startInterview } from "@/lib/interviews";

const comp = z.string().refine((c) => c in COMPETENCIES);
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), application_id: z.string().uuid(), mode: z.enum(["ai", "human"]) }),
  z.object({ action: z.literal("scorecard"), application_id: z.string().uuid(), scores: z.array(z.object({ competency: comp, score: z.number().int().min(1).max(5), evidence: z.string().max(500).nullable().optional() })).max(6),
    answers: z.record(z.string(), z.string().max(2000)), knockouts: z.array(z.string().max(200)).max(6), notes: z.string().max(4000).nullable().optional(), complete: z.boolean() }),
  z.object({ action: z.literal("finish"), id: z.string().uuid() }),
  z.object({ action: z.literal("decide"), id: z.string().uuid(), decision: z.enum(["invite", "follow_up", "decline"]), reason: z.string().max(500).nullable().optional() }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, b.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const d = b.data;
  const who = v!.fullName ?? v!.email;
  if (d.action === "start") { const r = await startInterview(d.application_id, d.mode, who); return Response.json(r, { status: r.ok ? 200 : 409 }); }
  if (d.action === "scorecard") {
    const r = await saveScorecard(d.application_id, { scores: d.scores as never, answers: d.answers, knockouts: d.knockouts, notes: d.notes ?? null, complete: d.complete }, who);
    return Response.json(r, { status: r.ok ? 200 : 409 });
  }
  if (d.action === "finish") { await finishInterview(d.id); return Response.json({ ok: true }); }
  const r = await decideInterview(d.id, d.decision, who, d.reason ?? null);
  return Response.json(r, { status: r.ok ? 200 : 409 });
}
