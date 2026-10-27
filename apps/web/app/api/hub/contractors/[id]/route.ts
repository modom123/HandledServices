/*
 * FILE    : apps/web/app/api/hub/contractors/[id]/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Staff: update a pro — activate after insurance/background check, suspend, edit capacity/ZIPs.
 * UPDATED : 2026-10-11_0451 UTC — changing a pro's status or offboarding is admins only; dispatchers can still edit capacity, ZIPs, notes and compliance dates.
 * UPDATED : 2026-10-27_1700 UTC — onboarding wiring: Activate goes through activatePro (logged for time-to-live, and the pro gets
 *           the "You're live" email and push) and "background cleared" through onBackgroundResult (logged, auto-activates when
 *           it was the last step). Before, both only flipped the column.
 */
import { z } from "zod";
import { ADMINS_ONLY, deny, getViewer, isAdmin, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { onboardingChecklist } from "@handled/core";
import { activatePro, onBackgroundResult } from "@/lib/recruiting";

const Patch = z.object({
  status: z.enum(["applied", "vetting", "approved", "suspended"]).optional(),
  insured_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  background_checked: z.boolean().optional(),
  daily_capacity: z.number().int().min(0).max(50).optional(),
  service_zips: z.array(z.string()).optional(),
  notes: z.string().max(4000).optional(),
  offboard_reason: z.string().max(500).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return deny(400, "Invalid update");
  if ((parsed.data.status !== undefined || parsed.data.offboard_reason) && !isAdmin(v)) return deny(403, ADMINS_ONLY);
  const { id } = await ctx.params;
  const db = adminClient();
  const who = v!.fullName ?? v!.email ?? "staff";
  const { status, background_checked, ...rest } = parsed.data;
  const update: Record<string, unknown> = { ...rest };
  if (status && status !== "approved") update.status = status;
  if (parsed.data.offboard_reason) { update.status = "suspended"; update.offboarded_at = new Date().toISOString(); }
  if (Object.keys(update).length) {
    const { error } = await db.from("contractors").update(update).eq("id", id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }
  // background cleared by staff: same path as a Checkr result (logged, and the pro goes live if that was the last step)
  if (background_checked) await onBackgroundResult(id, "clear", who);
  if (status === "approved") {
    const { data: c } = await db.from("contractors").select("*").eq("id", id).single();
    const { steps, complete } = onboardingChecklist(c);
    if (!complete) return deny(400, `Finish onboarding first: ${steps.filter((x) => !x.done).map((x) => x.label).join(", ")}`);
    // activatePro: logs "activated" (time-to-live metrics) and tells the pro they're live
    await activatePro(id, who);
  }
  return Response.json({ ok: true });
}
