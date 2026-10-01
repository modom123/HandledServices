/*
 * FILE    : apps/web/app/api/account/jobs/[id]/cancel/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2124 UTC
 * PURPOSE : Customer cancels a booking. Free more than 24 hours before the arrival window;
 *           inside 24 hours the late-cancellation fee is kept (Service Agreement §5).
 */
import { deny, getViewer } from "@/lib/auth";
import { getJob } from "@/lib/jobs";
import { cancelJob } from "@/lib/pro-benefits";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in first");
  const { id } = await ctx.params;
  const { data: mine } = await v.db.from("jobs").select("id").eq("id", id).maybeSingle(); // RLS: own jobs only
  if (!mine) return deny(404, "Not found");
  const job = await getJob(id);
  if (!job || job.remedy) return deny(409, "This booking can't be cancelled online — message us");
  const r = await cancelJob(id, "customer", v.email ?? "customer");
  return r.ok ? Response.json(r) : deny(409, r.error ?? "Can't cancel");
}
