/*
 * FILE    : apps/web/app/api/pro/jobs/[id]/expenses/[expenseId]/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-23_2200 UTC
 * PURPOSE : POST (multipart: file) — the receipt photo for a materials-card purchase on this job. Every card swipe needs its
 *           receipt; the job can't be closed out cleanly without them.
 */
import { deny, getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { uploadDoc } from "@/lib/photos";
import { addEvent } from "@/lib/jobs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string; expenseId: string }> }) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const { id, expenseId } = await ctx.params;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.size) return deny(400, "Attach a photo of the receipt");
  const db = adminClient();
  const { data: e } = await db.from("job_expenses").select("id, job_id, contractor_id, amount, merchant_name").eq("id", expenseId).maybeSingle();
  if (!e || e.job_id !== id || e.contractor_id !== v.contractorId) return deny(404, "Not your purchase");
  try {
    const path = await uploadDoc(file, `${v.contractorId}/receipts/${id}`);
    await db.from("job_expenses").update({ receipt_path: path }).eq("id", expenseId);
    await addEvent(id, "materials", `Receipt added for ${e.merchant_name ?? "a materials card purchase"} (${Number(e.amount).toFixed(2)})`, "pro", false);
    return Response.json({ ok: true });
  } catch (err) {
    return deny(400, err instanceof Error ? err.message : "Upload failed");
  }
}
