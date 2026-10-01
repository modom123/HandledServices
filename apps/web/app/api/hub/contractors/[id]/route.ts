/*
 * FILE    : apps/web/app/api/hub/contractors/[id]/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Staff: update a pro — activate after insurance/background check, suspend, edit capacity/ZIPs.
 */
import { z } from "zod";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";

const Patch = z.object({
  status: z.enum(["applied", "vetting", "approved", "suspended"]).optional(),
  insured_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  background_checked: z.boolean().optional(),
  daily_capacity: z.number().int().min(0).max(50).optional(),
  service_zips: z.array(z.string()).optional(),
  notes: z.string().max(4000).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return deny(400, "Invalid update");
  const { id } = await ctx.params;
  const db = adminClient();
  if (parsed.data.status === "approved") {
    const { data: c } = await db.from("contractors").select("insured_until, background_checked").eq("id", id).single();
    const insured = parsed.data.insured_until ?? c?.insured_until;
    const checked = parsed.data.background_checked ?? c?.background_checked;
    if (!insured || new Date(insured) < new Date() || !checked) return deny(400, "Verify insurance date and background check before activating");
  }
  const { error } = await db.from("contractors").update(parsed.data).eq("id", id);
  return error ? Response.json({ error: error.message }, { status: 500 }) : Response.json({ ok: true });
}
