/*
 * FILE    : apps/web/app/api/promo/check/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_0316 UTC
 * PURPOSE : Booking screen preview: Plus member saving + promo / gift card / referral code for
 *           this service and price. The same rules run again at booking (priceBenefits).
 */
import { z } from "zod";
import { RUSH_SURCHARGE, splitJob } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { priceBenefits } from "@/lib/growth";
import { rateLimit } from "@/lib/ratelimit";

const Body = z.object({ slug: z.string(), price: z.coerce.number().positive().max(1_000_000), rush: z.boolean().default(false), email: z.string().email().optional().or(z.literal("")), code: z.string().max(40).optional() });

export async function POST(req: Request) {
  const limited = await rateLimit(req, "booking");
  if (limited) return limited;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return Response.json({ error: "Bad request" }, { status: 400 });
  const v = await getViewer(req).catch(() => null);
  const { slug, price, rush, email, code } = b.data;
  const r = await priceBenefits({ slug, listPrice: price, payout: splitJob(price, slug).payout, rushFee: rush ? Math.round(price - price / (1 + RUSH_SURCHARGE)) : 0, email: email || v?.email, profileId: v?.userId ?? null, code: code || null });
  return Response.json(r);
}
