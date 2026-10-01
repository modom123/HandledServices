/*
 * FILE    : apps/web/app/api/pro/payouts/instant/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2124 UTC
 * PURPOSE : Pro: cash out approved payouts now (instant pay), or start Stripe payout setup.
 */
import { deny, getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { cashOutNow } from "@/lib/pro-benefits";
import { connectOnboardingUrl } from "@/lib/stripe";

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const { setup } = (await req.json().catch(() => ({}))) as { setup?: boolean };
  if (setup) {
    const { data: c } = await adminClient().from("contractors").select("id, email, business_name, stripe_account_id").eq("id", v.contractorId).single();
    const url = c ? await connectOnboardingUrl(c) : null;
    return url ? Response.json({ url }) : deny(503, "Payout setup isn't available yet");
  }
  const r = await cashOutNow(v.contractorId);
  return r.ok ? Response.json(r) : Response.json(r, { status: 409 });
}
