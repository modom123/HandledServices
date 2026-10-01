/*
 * FILE    : apps/web/app/api/hub/jobs/[id]/rating/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2000 UTC
 * PURPOSE : Staff: our rating of the pro on this job (overrides the AI draft).
 */
import { z } from "zod";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";

const score = z.number().int().min(1).max(5);
const Body = z.object({ rating: score, quality: score.optional(), punctuality: score.optional(), professionalism: score.optional(), comment: z.string().max(1000).optional() });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return deny(400, "Ratings are 1–5");
  const { id } = await ctx.params;
  const db = adminClient();
  const { data: job } = await db.from("jobs").select("contractor_id").eq("id", id).single();
  if (!job?.contractor_id) return deny(409, "No pro on this job");
  const { error } = await db.from("ops_ratings").upsert({ job_id: id, contractor_id: job.contractor_id, ...parsed.data, source: "staff", rated_by: v!.fullName ?? v!.email }, { onConflict: "job_id" });
  return error ? Response.json({ error: error.message }, { status: 500 }) : Response.json({ ok: true });
}
