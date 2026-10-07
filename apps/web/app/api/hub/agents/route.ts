/*
 * FILE    : apps/web/app/api/hub/agents/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-06_0752 UTC
 * PURPOSE : Hub → AI agents (staff). POST JSON:
 *             { action: "assign", agent, title, target?, due_date? }   — give an agent a task (it sees it on every run)
 *             { action: "close", id, status: done|cancelled|open, note? }
 *             { action: "plan" }                                      — run the Growth planner now (admin)
 */
import { z } from "zod";
import { AGENTS } from "@handled/core";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { assignTask, closeTask } from "@/lib/ai/agent-tasks";
import { runGrowthPlanner } from "@/lib/ai/growth-planner";

export const maxDuration = 120;

const kinds = ["all", ...AGENTS.map((a) => a.kind)] as [string, ...string[]];
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assign"), agent: z.enum(kinds), title: z.string().trim().min(3).max(300), target: z.string().trim().max(200).nullable().optional(), due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal("")) }),
  z.object({ action: z.literal("close"), id: z.string().uuid(), status: z.enum(["done", "cancelled", "open"]), note: z.string().max(300).nullable().optional() }),
  z.object({ action: z.literal("plan") }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, b.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const d = b.data;
  const who = v!.fullName ?? v!.email;
  try {
    if (d.action === "assign") return Response.json({ ok: true, task: await assignTask({ agent: d.agent, title: d.title, target: d.target || null, due_date: d.due_date || null }, who) });
    if (d.action === "close") { await closeTask(d.id, d.status, d.note ?? null, who); return Response.json({ ok: true }); }
    if (v!.role !== "admin") return deny(403, "Only an admin can run the planner");
    const r = await runGrowthPlanner();
    return r ? Response.json({ ok: true, assigned: r.assigned, closed: r.closed }) : Response.json({ ok: false, error: "AI unavailable (check ANTHROPIC_API_KEY)" }, { status: 503 });
  } catch (e) {
    return Response.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
