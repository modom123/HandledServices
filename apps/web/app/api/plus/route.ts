/*
 * FILE    : apps/web/app/api/plus/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_0316 UTC
 * PURPOSE : Join Handled Plus → Stripe subscription Checkout (signed-in customers).
 * UPDATED : 2026-10-03_0042 UTC — records acceptance of the Plus, Gift Card & Promo Terms (My contracts).
 */
import { deny, getViewer } from "@/lib/auth";
import { startMembership } from "@/lib/growth";
import { MEMBERSHIP_PROMO_TERMS } from "@/lib/contracts";
import { recordAcceptance, requestMeta } from "@/lib/contracts/record";
import { getLocale } from "@/lib/locale";

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in to join");
  const r = await startMembership({ email: v.email, profileId: v.userId, name: v.fullName });
  if (r.url) await recordAcceptance([MEMBERSHIP_PROMO_TERMS], { profileId: v.userId, email: v.email, signerName: v.fullName, method: "checkout", locale: await getLocale(), ...requestMeta(req) });
  return r.url ? Response.json(r) : deny(409, r.error ?? "Try again");
}
