/*
 * FILE    : apps/web/app/api/account/jobs/[id]/pay/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1900 UTC
 * PURPOSE : Customer "Pay now" — a fresh Checkout link for one of their own unpaid jobs.
 */
import { deny, getViewer } from "@/lib/auth";
import { getJob } from "@/lib/jobs";
import { paymentCheckoutUrl } from "@/lib/stripe";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in first");
  const { id } = await ctx.params;
  // RLS: the customer can only read their own jobs
  const { data: mine } = await v.db.from("jobs").select("id").eq("id", id).maybeSingle();
  if (!mine) return deny(404, "Not found");
  const job = await getJob(id);
  if (!job || job.paid_at || !job.price_final) return deny(409, "Nothing to pay");
  const url = await paymentCheckoutUrl(job);
  return url ? Response.json({ url }) : deny(503, "Online payment isn't set up yet — we'll call you to take payment.");
}
