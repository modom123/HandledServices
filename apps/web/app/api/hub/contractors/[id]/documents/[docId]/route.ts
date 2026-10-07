/*
 * FILE    : apps/web/app/api/hub/contractors/[id]/documents/[docId]/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-01_2000 UTC
 * UPDATED : 2026-10-02_0157 UTC — uses decideDocument() (shared with the IEBC agents).
 * PURPOSE : Staff: open (signed URL), verify or reject a pro's compliance document.
 *           Verifying a COI sets insured_until; a license sets license_expires; a
 *           background report marks the background check cleared; auto, workers' comp, bond
 *           and liquor liability set contractors.coverage[kind] to the policy expiry.
 */
import { z } from "zod";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { signedDocUrl } from "@/lib/photos";
import { decideDocument } from "@/lib/recruiting";

export async function GET(req: Request, ctx: { params: Promise<{ id: string; docId: string }> }) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const { id, docId } = await ctx.params;
  const { data: doc } = await adminClient().from("contractor_documents").select("storage_path").eq("id", docId).eq("contractor_id", id).single();
  const url = doc?.storage_path ? await signedDocUrl(doc.storage_path) : null;
  return url ? Response.redirect(url, 302) : deny(404, "No file");
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string; docId: string }> }) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const body = z.object({ decision: z.enum(["verify", "reject"]), notes: z.string().max(500).optional() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return deny(400, "decision required");
  const { id, docId } = await ctx.params;
  try {
    await decideDocument(id, docId, body.data.decision, v!.fullName ?? v!.email, body.data.notes ?? null);
  } catch (e) {
    return deny(404, e instanceof Error ? e.message : "Not found");
  }
  return Response.json({ ok: true });
}
