/*
 * FILE    : apps/web/app/api/account/me/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : Account basics for the app: Handled Plus status and my refer-a-friend code/link.
 * UPDATED : 2026-10-07_0530 UTC — Handled Points balance and tier (full detail: /api/account/loyalty).
 */
import { deny, getViewer } from "@/lib/auth";
import { activeMembership, ensureReferralCode } from "@/lib/growth";
import { siteUrl } from "@/lib/notify";
import { loyaltyFor } from "@/lib/loyalty";

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in first");
  const [member, code, pts] = await Promise.all([activeMembership(v.email, v.userId).catch(() => null), ensureReferralCode(v.userId).catch(() => null), loyaltyFor({ profileId: v.userId, email: v.email }).catch(() => null)]);
  return Response.json({ email: v.email, member: Boolean(member), memberUntil: member?.current_period_end ?? null, referralCode: code, referralLink: code ? `${siteUrl()}/book?promo=${code}` : null,
    points: pts ? { available: pts.available, pending: pts.pending, worth: pts.worth, tier: pts.tier.key } : null });
}
