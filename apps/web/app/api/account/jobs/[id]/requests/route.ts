/*
 * FILE    : apps/web/app/api/account/jobs/[id]/requests/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_0221 UTC
 * PURPOSE : Customer special requests on their job's checklist, before the work starts (up to 5).
 *             POST { text }   — add ("please use the side door", "skip the office")
 *             DELETE ?id=     — remove one of their own requests
 *             GET             — the job's checklist, progress once work starts, and their requests (app)
 *           A request isn't extra paid work: anything outside what was booked goes through a change order.
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { addSpecial, checklistState, removeSpecial } from "@/lib/checklists";
import type { Job } from "@handled/core";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const v = await mine(req, id);
  if (!v) return deny(404, "Job not found");
  const { data } = await adminClient().from("jobs").select("*").eq("id", id).single();
  const job = data as Job;
  const st = await checklistState(job);
  const started = ["in_progress", "qa_review", "completed"].includes(job.status);
  return Response.json({ ok: true, checklist: st.checklist, checks: started ? st.checks : null, requests: (job.checklist_extra ?? []).filter((x) => x.from === "customer"),
    canEdit: ["requested", "quoted", "scheduled", "dispatched", "assigned", "site_visit"].includes(job.status) });
}

async function mine(req: Request, id: string) {
  const v = await getViewer(req);
  if (!v) return null;
  const { data } = await adminClient().from("jobs").select("id, customer_id").eq("id", id).maybeSingle();
  return data && data.customer_id === v.userId ? v : null;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const v = await mine(req, id);
  if (!v) return deny(404, "Job not found");
  const b = z.object({ text: z.string().min(3).max(300) }).safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Write your request (3–300 characters)");
  const r = await addSpecial(id, b.data.text, "customer", false, v.email);
  return Response.json(r, { status: r.ok ? 200 : 409 });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const v = await mine(req, id);
  if (!v) return deny(404, "Job not found");
  const x = new URL(req.url).searchParams.get("id");
  if (!x) return deny(400, "id required");
  const r = await removeSpecial(id, x, "customer");
  return Response.json(r, { status: r.ok ? 200 : 409 });
}
