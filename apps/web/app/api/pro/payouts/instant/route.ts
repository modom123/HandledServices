/*
 * FILE    : apps/web/app/api/pro/payouts/instant/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2124 UTC
 * UPDATED : 2026-10-01_2140 UTC — GET: balance, fee and eligibility (mobile app).
 * PURPOSE : Pro: cash out approved payouts now (instant pay), or start Stripe payout setup.
 */
import { deny, getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { instantPayFee, whyNot, type Contractor } from "@handled/core";
import { availableBalance, cashOutNow, getPolicy } from "@/lib/pro-benefits";
import { connectOnboardingUrl, connectReady } from "@/lib/stripe";

/** What the pro can cash out now, the fee, and whether instant pay is set up. */
export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const [{ data: me }, policy, bal] = await Promise.all([adminClient().from("contractors").select("*").eq("id", v.contractorId).single(), getPolicy(), availableBalance(v.contractorId)]);
  const reason = me ? whyNot(policy.instantPay, me as Contractor) : "pro not found";
  const ready = !reason && (await connectReady(me?.stripe_account_id ?? null));
  return Response.json({ balance: bal.total, fee: instantPayFee(policy, bal.total), minAmount: policy.instantPay.minAmount, feePct: policy.instantPay.feePct, allowed: !reason, reason, ready });
}

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
