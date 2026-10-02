/*
 * FILE    : apps/web/app/api/account/jobs/[id]/google-review/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_2236 UTC
 * PURPOSE : Customer tapped "Review us on Google" after rating a job (web or app). Records the
 *           tap on their review so Hub → Growth can show how many reviews we're asking for.
 */
import { deny, getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in first");
  const { id } = await ctx.params;
  const { data: mine } = await v.db.from("jobs").select("id").eq("id", id).maybeSingle(); // RLS: own jobs only
  if (!mine) return deny(404, "Not found");
  await adminClient().from("reviews").update({ google_clicked_at: new Date().toISOString() }).eq("job_id", id).is("google_clicked_at", null);
  return Response.json({ ok: true });
}
