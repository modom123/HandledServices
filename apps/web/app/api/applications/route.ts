/*
 * FILE    : apps/web/app/api/applications/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0006 UTC — automated: stores where the applicant came from (source,
 *           referral, UTM), de-duplicates by email, confirms to the applicant right away, then
 *           AI-screens and auto-invites strong applicants (lib/recruiting.ts).
 * PURPOSE : Subcontractor application → stored, confirmed, screened, invited or queued for staff.
 */
import { after } from "next/server";
import { z } from "zod";
import { BRAND } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { sendEmail, siteUrl } from "@/lib/notify";
import { logRecruiting, onApplication, signInUrl } from "@/lib/recruiting";

const Body = z.object({
  business_name: z.string().min(2), contact_name: z.string().min(2), email: z.string().email(), phone: z.string().min(7),
  trades: z.array(z.string()).min(1), zips: z.string().max(400).optional(), years_experience: z.coerce.number().int().min(0).max(80).optional(),
  crew_size: z.coerce.number().int().min(1).max(200).optional(), insured: z.boolean().default(false), license_number: z.string().max(80).optional(),
  has_vehicle: z.boolean().default(true), message: z.string().max(2000).optional(),
  specialties: z.array(z.string().max(40)).max(40).default([]), coverages_held: z.array(z.enum(["auto", "workers_comp", "bond", "liquor"])).default([]),
  equipment: z.string().max(500).optional(), references_text: z.string().max(1000).optional(), work_links: z.string().max(1000).optional(),
  source: z.string().max(60).optional(), ref: z.string().max(60).optional(), utm: z.record(z.string(), z.string().max(120)).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please check the form" }, { status: 400 });
  const { ref, ...b } = parsed.data;
  const email = b.email.trim().toLowerCase();
  const db = adminClient();

  // already a pro → send them a sign-in link instead of a second application
  const { data: pro } = await db.from("contractors").select("id, status, dropped_at").eq("email", email).maybeSingle();
  if (pro) {
    if (pro.dropped_at) await db.from("contractors").update({ dropped_at: null, invited_at: new Date().toISOString(), onboarding_reminders: 0 }).eq("id", pro.id);
    const link = await signInUrl(email, pro.status === "approved" ? "/pro" : "/pro/onboarding");
    await sendEmail(email, `Your ${BRAND.name} sign-in link`, `You already have a ${BRAND.name} pro account${pro.status === "approved" ? "" : " — your setup progress is saved"}. One click signs you in:\n${link}\n\n— ${BRAND.name}`);
    await logRecruiting("reapplied", { contractorId: pro.id }, "sent sign-in link");
    return Response.json({ ok: true, existing: true });
  }

  // referral: /pros?ref=<referring pro's id> (the link on every pro's dashboard)
  let referred_by: string | null = null;
  if (ref && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref)) {
    const { data: r } = await db.from("contractors").select("id").eq("id", ref).maybeSingle();
    referred_by = r?.id ?? null;
  }
  // same email applied before and not decided → update that application instead of a duplicate
  const { data: prior } = await db.from("contractor_applications").select("id, stage").ilike("email", email).in("stage", ["applied", "screened"]).maybeSingle();
  const row = { ...b, email, referred_by, source: b.source ?? (referred_by ? "referral" : null), last_contact_at: new Date().toISOString() };
  const { data, error } = prior
    ? await db.from("contractor_applications").update(row).eq("id", prior.id).select("id").single()
    : await db.from("contractor_applications").insert(row).select("id").single();
  if (error || !data) return Response.json({ error: error?.message ?? "Couldn't save" }, { status: 500 });
  await logRecruiting(prior ? "application_updated" : "applied", { applicationId: data.id }, row.source ?? null, "applicant");

  await sendEmail(email, `We got your ${BRAND.name} application`,
    `Hi ${b.contact_name.split(" ")[0]},\n\nThanks for applying to ${BRAND.name}. Here's what happens next:\n\n1. We review your application — usually the same day, always within 2 business days.\n2. If it's a fit, you get an invite with a one-click link to your setup checklist (W-9, agreement, insurance, license if your trade needs one, background check, payout). About 15 minutes on your phone.\n3. Once it's verified, job offers start.\n\nHave these handy to go faster: your certificate of insurance${b.trades.some((t) => ["plumbing", "electrical", "hvac", "remodel", "painting", "catering", "food_truck"].includes(t)) ? ", your trade license" : ""} and your bank details for payouts.\n\nWhat we offer pros: ${siteUrl()}/pros\n\n— ${BRAND.name}`);
  after(() => onApplication(data.id).catch((e) => console.error("[recruiting]", e)));
  return Response.json({ ok: true });
}
