/*
 * FILE    : apps/web/app/api/pro/orientation/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-28_2245 UTC
 * PURPOSE : "Welcome to Handled" orientation. POST { lesson, choice }: a right answer marks the lesson done; when the
 *           last one is done the onboarding step completes (afterOnboardingStep → "Ready to approve" when the rest is in).
 */
import { after } from "next/server";
import { z } from "zod";
import { ORIENTATION, orientationAnswer, orientationStatus } from "@handled/core";
import { deny, getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { afterOnboardingStep } from "@/lib/recruiting";

const Body = z.object({ lesson: z.enum(ORIENTATION.map((l) => l.id) as [string, ...string[]]), choice: z.number().int().min(0).max(9) });

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return deny(400, "Pick an answer");
  if (!orientationAnswer(p.data.lesson, p.data.choice)) return Response.json({ ok: false, correct: false });
  const db = adminClient();
  const { data: c, error } = await db.from("contractors").select("orientation").eq("id", v.contractorId).single();
  if (error) return deny(500, "Orientation isn't switched on yet. Ask Handled to run supabase/setup/ADD_PRO_WELCOME_2026-10-28_2300.sql.");
  const progress = { ...((c?.orientation as Record<string, string> | null) ?? {}) };
  const wasComplete = orientationStatus(progress).complete;
  progress[p.data.lesson] ??= new Date().toISOString();
  const { error: e2 } = await db.from("contractors").update({ orientation: progress }).eq("id", v.contractorId);
  if (e2) return deny(500, e2.message);
  const s = orientationStatus(progress);
  if (s.complete && !wasComplete) after(() => afterOnboardingStep(v.contractorId!, "orientation").catch((e) => console.error("[orientation]", e)));
  return Response.json({ ok: true, correct: true, done: s.done, total: s.total, complete: s.complete, next: s.next?.id ?? null });
}
