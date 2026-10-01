/*
 * FILE    : apps/web/app/api/hub/applications/[id]/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Staff: approve or reject a subcontractor application. Approval creates the contractor record (status vetting until insurance + background check are confirmed).
 */
import { z } from "zod";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { sendEmail, siteUrl } from "@/lib/notify";
import { BRAND } from "@handled/core";

const Body = z.object({ decision: z.enum(["approve", "reject", "reviewing"]) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return deny(400, "decision required");
  const db = adminClient();
  const { data: app } = await db.from("contractor_applications").select("*").eq("id", id).single();
  if (!app) return deny(404, "Not found");
  const status = parsed.data.decision === "approve" ? "approved" : parsed.data.decision === "reject" ? "rejected" : "reviewing";
  await db.from("contractor_applications").update({ status }).eq("id", id);
  if (status === "approved") {
    const zips = String(app.zips ?? "").split(/[,\s]+/).filter((z: string) => /^\d{3,5}\*?$/.test(z));
    const { error } = await db.from("contractors").upsert({
      business_name: app.business_name, contact_name: app.contact_name, email: app.email.toLowerCase(), phone: app.phone,
      trades: app.trades, specialties: app.specialties ?? [], service_zips: zips, license_number: app.license_number, status: "vetting",
      daily_capacity: Math.max(2, Math.min(10, (app.crew_size ?? 1) * 2)), application_id: app.id,
    }, { onConflict: "email" });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    await sendEmail(app.email, `Welcome to ${BRAND.name}`, `You're in, ${app.contact_name.split(" ")[0]}! You'll work with us as an independent business (1099).\n\nSign in with this email at ${siteUrl()}/login, then finish setup at ${siteUrl()}/pro/onboarding:\n• W-9\n• Independent contractor agreement\n• Your specialties\n• Certificate of insurance (general liability, Handled named as additional insured)\n• Any trade-specific coverage (commercial auto, bond, workers' comp or a no-employees statement)\n• Trade license (plumbing, electrical, HVAC, painting, remodeling, food service)\n• Background check\n• Payout method\n\nOffers start the day you're activated.`);
  }
  return Response.json({ ok: true });
}
