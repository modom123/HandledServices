/*
 * FILE    : apps/web/app/api/pro/jobs/[id]/expenses/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-01_2124 UTC
 * UPDATED : 2026-10-01_2140 UTC — GET: eligibility + receipts on this job (mobile app).
 * PURPOSE : Pro submits a materials receipt (multipart: amount, description, vendor, file).
 * UPDATED : 2026-10-23_2200 UTC — receipts name the store (vendor); GET also returns the approved vendors for this job,
 *           the materials estimate and what's left of it, and the pro's materials card.
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { billsMaterialsAtCost, getService, materialsAllowance, vendorsForTrades, whyNot, type Contractor } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { getPolicy, submitExpense } from "@/lib/pro-benefits";
import { vendorList } from "@/lib/materials";

/** Can this pro claim materials on this job, the limits, and receipts already sent. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const { id } = await ctx.params;
  const db = adminClient();
  const [{ data: job }, { data: me }, { data: expenses }, policy] = await Promise.all([
    db.from("jobs").select("*").eq("id", id).single(),
    db.from("contractors").select("*").eq("id", v.contractorId).single(),
    db.from("job_expenses").select("*").eq("job_id", id).eq("contractor_id", v.contractorId).order("created_at"),
    getPolicy(),
  ]);
  if (!job || job.contractor_id !== v.contractorId) return deny(404, "Not your job");
  const trades = (getService(job.service_slug)?.trades ?? []).filter((t) => (me?.trades ?? []).includes(t));
  const trade = trades[0];
  const rule = billsMaterialsAtCost(job.service_slug) ? { ...policy.materials, trades: [] } : policy.materials;
  const reason = me ? whyNot(rule, me as Contractor, trade) : "pro not found";
  const shopping = Boolean(trade && policy.materials.shoppingTrades.includes(trade));
  const list = (expenses ?? []) as { amount: number; status: string; receipt_path: string | null; source?: string }[];
  const spent = list.filter((e) => ["pending", "approved", "billed", "paid"].includes(e.status)).reduce((t, e) => t + Number(e.amount), 0);
  const allowance = materialsAllowance(job, policy.materials.maxShareOfPrice);
  const vendors = vendorsForTrades(trades, await vendorList()).map((x) => ({ id: x.id, name: x.name, online: Boolean(x.online) }));
  return Response.json({
    allowed: !reason, reason, autoApproveUpTo: policy.materials.autoApproveUpTo, shopping,
    estimate: job.materials_high ? { low: Number(job.materials_low ?? 0), high: Number(job.materials_high), note: job.materials_note ?? null } : null,
    allowance, left: Math.max(0, Math.round((allowance - spent) * 100) / 100), vendors,
    card: me?.materials_card_id ? { last4: me.materials_card_last4, status: me.materials_card_status, onThisJob: me.card_job_id === id } : null,
    needsReceipt: list.filter((e) => e.source === "card" && !e.receipt_path && e.status !== "rejected").length,
    expenses: list,
  });
}

const Body = z.object({ amount: z.coerce.number().positive().max(20000), description: z.string().min(3).max(300), vendor: z.string().max(120).optional().default("") });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const form = await req.formData().catch(() => null);
  if (!form) return deny(400, "Send a form");
  const b = Body.safeParse({ amount: form.get("amount"), description: form.get("description"), vendor: form.get("vendor") ?? "" });
  if (!b.success) return deny(400, "Amount and what you bought are required");
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return deny(400, "Attach a photo of the receipt");
  const { id } = await ctx.params;
  try {
    const r = await submitExpense(id, v.contractorId, Math.round(b.data.amount * 100) / 100, b.data.description, file, b.data.vendor);
    return r.ok ? Response.json(r) : deny(409, r.error ?? "Not accepted");
  } catch (e) {
    return deny(400, e instanceof Error ? e.message : "Upload failed");
  }
}
