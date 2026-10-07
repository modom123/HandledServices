/*
 * FILE    : apps/web/app/api/account/loyalty/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0530 UTC
 * PURPOSE : Handled Points for the signed-in person (web + app).
 *             GET  ?business=<account id>              — balance, tier, history, unused credit codes
 *             POST { points, business_id? }            — turn points into a credit code (business accounts: admins)
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { memberOf } from "@/lib/business";
import { loyaltyFor, redeemPoints, type LoyaltyAccount } from "@/lib/loyalty";

async function accountFor(v: { userId: string; email: string }, businessId: string | null, needAdmin: boolean): Promise<LoyaltyAccount | string> {
  if (!businessId) return { profileId: v.userId, email: v.email };
  const m = await memberOf(v, businessId);
  if (!m) return "Not a member of that business account";
  if (needAdmin && m.role !== "admin") return "Only an account admin can redeem the business account's points";
  return { businessId };
}

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in first");
  const biz = new URL(req.url).searchParams.get("business");
  if (biz && !z.string().uuid().safeParse(biz).success) return deny(400, "Bad account id");
  const a = await accountFor(v, biz, false);
  if (typeof a === "string") return deny(403, a);
  return Response.json(await loyaltyFor(a));
}

const Body = z.object({ points: z.number().int().min(1).max(10_000_000), business_id: z.string().uuid().nullable().optional() });

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in first");
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Points are required");
  const a = await accountFor(v, b.data.business_id ?? null, true);
  if (typeof a === "string") return deny(403, a);
  const r = await redeemPoints(a, b.data.points, { profileId: v.userId, email: v.email });
  return Response.json(r, { status: r.ok ? 200 : 409 });
}
