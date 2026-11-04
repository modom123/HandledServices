/*
 * FILE    : apps/web/app/api/pro/refer/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-28_2300 UTC
 * PURPOSE : GET → { partner: { code, link, short } | null, stats, ready } for the app's Refer & earn screen.
 *           POST: Pro portal → Refer & earn → "Start earning": makes the signed-in pro a referral partner (kind "pro") with
 *           their portal details, after they accept the partner terms. POST { agree: true }. Commissions are paid into
 *           the Stripe account they use for job payouts.
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { partnerFor, partnerLink, partnerStats, payoutAccount, payoutsReady, signUp } from "@/lib/partners";
import { siteUrl } from "@/lib/notify";
import { clientIp } from "@/lib/ratelimit";

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const partner = await partnerFor(v);
  if (!partner) return Response.json({ partner: null });
  const [stats, ready] = await Promise.all([partnerStats(partner.id), payoutsReady(partner)]);
  return Response.json({ partner: { code: partner.code, link: partnerLink(partner.code), short: `${siteUrl()}/r/${partner.code}`, status: partner.status }, stats, ready, proLink: `${siteUrl()}/pros?ref=${v.contractorId}` });
}

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  if (!z.object({ agree: z.literal(true) }).safeParse(await req.json().catch(() => null)).success) return deny(400, "Agree to the partner terms first");
  const { data: c } = await adminClient().from("contractors").select("contact_name, business_name, email, phone").eq("id", v.contractorId).single();
  if (!c) return deny(404, "No pro account");
  try {
    const { partner } = await signUp({ name: c.contact_name, email: c.email, phone: c.phone, company: c.business_name, kind: "pro", how: "Joined from the pro portal", ip: clientIp(req) });
    await payoutAccount(partner); // commissions go to the same Stripe account as their job pay
    return Response.json({ ok: true, code: partner.code });
  } catch (e) {
    return deny(500, e instanceof Error ? e.message : "Couldn't sign you up");
  }
}
