/*
 * FILE    : apps/web/app/api/hub/contractors/[id]/license/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-13_0200 UTC
 * PURPOSE : Staff: verify a pro's trade license, USDOT number or certification without waiting for an upload — checked
 *           in the state lookup (e.g. Michigan LARA), the FMCSA/USDOT database, with the issuing agency, or seen on a
 *           call. Sets license_number and license_expires (or NO_EXPIRY), records a verified document with how it was
 *           checked, and re-runs the onboarding step (the pro may be ready to activate).
 */
import { z } from "zod";
import { NO_EXPIRY } from "@handled/core";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { afterOnboardingStep } from "@/lib/recruiting";

const Body = z.object({
  license_number: z.string().trim().min(2).max(60),
  expires_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  no_expiry: z.boolean().optional(),
  how: z.string().trim().min(3).max(300),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Add the license number and how you checked it");
  const expires = b.data.no_expiry ? NO_EXPIRY : b.data.expires_on || null;
  if (!expires) return deny(400, "Add the expiry date, or tick \"Doesn't expire\"");
  const { id } = await ctx.params;
  const actor = v!.fullName ?? v!.email;
  const db = adminClient();
  const { error } = await db.from("contractors").update({ license_number: b.data.license_number, license_expires: expires }).eq("id", id);
  if (error) return deny(400, error.message);
  await db.from("contractor_documents").insert({ contractor_id: id, kind: "license", status: "verified", verified_by: actor, verified_at: new Date().toISOString(), expires_on: expires,
    notes: `#${b.data.license_number} · verified by Handled without an upload: ${b.data.how}` });
  await afterOnboardingStep(id, "license verified by staff", actor).catch(() => {});
  return Response.json({ ok: true });
}
