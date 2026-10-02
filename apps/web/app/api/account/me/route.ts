/*
 * FILE    : apps/web/app/api/account/me/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : Account basics for the app: Handled Plus status and my refer-a-friend code/link.
 */
import { deny, getViewer } from "@/lib/auth";
import { activeMembership, ensureReferralCode } from "@/lib/growth";
import { siteUrl } from "@/lib/notify";

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in first");
  const [member, code] = await Promise.all([activeMembership(v.email, v.userId).catch(() => null), ensureReferralCode(v.userId).catch(() => null)]);
  return Response.json({ email: v.email, member: Boolean(member), memberUntil: member?.current_period_end ?? null, referralCode: code, referralLink: code ? `${siteUrl()}/book?promo=${code}` : null });
}
