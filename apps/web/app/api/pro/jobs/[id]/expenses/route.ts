/*
 * FILE    : apps/web/app/api/pro/jobs/[id]/expenses/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2124 UTC
 * PURPOSE : Pro submits a materials receipt (multipart: amount, description, file).
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { submitExpense } from "@/lib/pro-benefits";

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
