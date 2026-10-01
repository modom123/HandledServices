/*
 * FILE    : apps/web/app/api/pro/jobs/[id]/expenses/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2124 UTC
 * UPDATED : 2026-10-01_2140 UTC — GET: eligibility + receipts on this job (mobile app).
 * PURPOSE : Pro submits a materials receipt (multipart: amount, description, file).
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { getService, whyNot, type Contractor } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { getPolicy, submitExpense } from "@/lib/pro-benefits";

/** Can this pro claim materials on this job, the limits, and receipts already sent. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const { id } = await ctx.params;
  const db = adminClient();
  const [{ data: job }, { data: me }, { data: expenses }, policy] = await Promise.all([
    db.from("jobs").select("service_slug, contractor_id").eq("id", id).single(),
    db.from("contractors").select("*").eq("id", v.contractorId).single(),
    db.from("job_expenses").select("id, amount, description, status, notes, created_at").eq("job_id", id).eq("contractor_id", v.contractorId).order("created_at"),
    getPolicy(),
  ]);
  if (!job || job.contractor_id !== v.contractorId) return deny(404, "Not your job");
  const trade = getService(job.service_slug)?.trades.find((t) => (me?.trades ?? []).includes(t));
  const reason = me ? whyNot(policy.materials, me as Contractor, trade) : "pro not found";
  const shopping = Boolean(trade && policy.materials.shoppingTrades.includes(trade));
  return Response.json({ allowed: !reason, reason, autoApproveUpTo: policy.materials.autoApproveUpTo, shopping, expenses: expenses ?? [] });
}

const Body = z.object({ amount: z.coerce.number().positive().max(20000), description: z.string().min(3).max(300) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const form = await req.formData().catch(() => null);
  if (!form) return deny(400, "Send a form");
  const b = Body.safeParse({ amount: form.get("amount"), description: form.get("description") });
  if (!b.success) return deny(400, "Amount and what you bought are required");
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return deny(400, "Attach a photo of the receipt");
  const { id } = await ctx.params;
  try {
    const r = await submitExpense(id, v.contractorId, Math.round(b.data.amount * 100) / 100, b.data.description, file);
    return r.ok ? Response.json(r) : deny(409, r.error ?? "Not accepted");
  } catch (e) {
    return deny(400, e instanceof Error ? e.message : "Upload failed");
  }
}
