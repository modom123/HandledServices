/*
 * FILE    : apps/web/app/api/pro/jobs/[id]/checklist/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_0221 UTC
 * PURPOSE : The pro's job checklist (lib/checklists.ts).
 *             GET                                   — checklist, what's checked, progress (app + portal)
 *             POST { item_id, status: done|na|undo, note? } — check an item (N/A needs the reason)
 */
import { z } from "zod";
import type { Job } from "@handled/core";
import { deny, getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { checkItem, checklistState, freezeChecklist } from "@/lib/checklists";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const { id } = await ctx.params;
  const { data } = await adminClient().from("jobs").select("*").eq("id", id).maybeSingle();
  const job = data as Job | null;
  if (!job || job.contractor_id !== v.contractorId) return deny(404, "Not your job");
  if (!job.checklist) job.checklist = await freezeChecklist(job);
  return Response.json({ ok: true, ...(await checklistState(job)), locked: !["assigned", "in_progress"].includes(job.status) });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const { id } = await ctx.params;
  const b = z.object({ item_id: z.string().min(3).max(80), status: z.enum(["done", "na", "undo"]), note: z.string().max(500).nullable().optional() }).safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check the request");
  const r = await checkItem(id, v.contractorId, b.data.item_id, b.data.status, b.data.note ?? null, v.fullName ?? v.email);
  return Response.json(r, { status: r.ok ? 200 : 409 });
}
