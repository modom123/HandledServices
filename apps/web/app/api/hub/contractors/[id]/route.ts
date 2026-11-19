/*
 * FILE    : apps/web/app/api/hub/contractors/[id]/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Staff: update a pro — activate after insurance/background check, suspend, edit capacity/ZIPs.
 * UPDATED : 2026-10-11_0451 UTC — changing a pro's status or offboarding is admins only; dispatchers can still edit capacity, ZIPs, notes and compliance dates.
 * UPDATED : 2026-10-27_1700 UTC — onboarding wiring: Activate goes through activatePro (logged for time-to-live, and the pro gets
 *           the "You're live" email and push) and "background cleared" through onBackgroundResult (logged, auto-activates when
 *           it was the last step). Before, both only flipped the column.
 * UPDATED : 2026-11-19_1850 UTC — work area set by staff: base_zip (located from the ZIP, city and state filled in),
 *           service_radius_mi and a typed ZIP list (zip_list: "48201, 481*" — listed ZIPs become the whole area).
 */
import { z } from "zod";
import { ADMINS_ONLY, deny, getViewer, isAdmin, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { onboardingChecklist, parseZipList, stateForZip } from "@handled/core";
import { zipCentroid } from "@/lib/geo";
import { afterOnboardingStep } from "@/lib/recruiting";
import { activatePro, onBackgroundResult } from "@/lib/recruiting";

const Patch = z.object({
  status: z.enum(["applied", "vetting", "approved", "suspended"]).optional(),
  insured_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  background_checked: z.boolean().optional(),
  daily_capacity: z.number().int().min(0).max(50).optional(),
  service_zips: z.array(z.string()).optional(),
  notes: z.string().max(4000).optional(),
  offboard_reason: z.string().max(500).optional(),
  // work area (staff can set it when the pro can't): ZIP, driving distance, and the ZIP codes they work in
  base_zip: z.string().trim().regex(/^\d{5}$/, "Enter a 5-digit ZIP").optional(),
  service_radius_mi: z.number().int().min(1).max(150).optional(),
  zip_list: z.string().max(3000).optional(),
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
  const { status, background_checked, base_zip, zip_list, ...rest } = parsed.data;
  const update: Record<string, unknown> = { ...rest };
  if (base_zip) {
    const loc = await zipCentroid(base_zip);
    const { data: zg } = await db.from("zip_geo").select("city, state").eq("zip", base_zip).maybeSingle();
    Object.assign(update, { base_zip, base_lat: loc?.lat ?? null, base_lng: loc?.lng ?? null, base_located: loc ? "zip" : null,
      base_city: zg?.city ?? null, base_state: zg?.state ?? stateForZip(base_zip), base_address: null });
  }
  if (zip_list !== undefined) {
    const zips = parseZipList(zip_list);
    Object.assign(update, { service_zips: zips, zips_only: zips.length > 0 });
  }
  if (status && status !== "approved") update.status = status;
  if (parsed.data.offboard_reason) { update.status = "suspended"; update.offboarded_at = new Date().toISOString(); }
  if (Object.keys(update).length) {
    const { error } = await db.from("contractors").update(update).eq("id", id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }
  // background cleared by staff: same path as a Checkr result (logged, and the pro goes live if that was the last step)
  if (background_checked) await onBackgroundResult(id, "clear", who);
  // a work area set by staff can be the last step: log it and raise "Ready to approve" if so
  if (base_zip || zip_list !== undefined) await afterOnboardingStep(id, "area (set by staff)", who).catch((e) => console.error("[hub] area step", e));
  if (status === "approved") {
    const { data: c } = await db.from("contractors").select("*").eq("id", id).single();
    const { steps, complete } = onboardingChecklist(c);
    if (!complete) return deny(400, `Finish onboarding first: ${steps.filter((x) => !x.done).map((x) => x.label).join(", ")}`);
    // activatePro: logs "activated" (time-to-live metrics) and tells the pro they're live
    await activatePro(id, who);
  }
  return Response.json({ ok: true });
}
