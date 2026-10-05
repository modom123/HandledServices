/*
 * FILE    : apps/web/app/api/bid-quote/[token]/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_1954 UTC
 * PURPOSE : A pro's written price for a bid, from the private link in the price-request email (no sign-in needed;
 *           the token is the key). POST { decline, prices: { lineId: unitPrice }, capacity, small_business, note }.
 */
import { z } from "zod";
import { deny } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { submitProQuote } from "@/lib/bids";

const Body = z.object({
  decline: z.boolean(),
  prices: z.record(z.string().uuid(), z.number().min(0).max(1_000_000)),
  capacity: z.string().trim().max(1000).nullable(),
  small_business: z.boolean().nullable(),
  note: z.string().trim().max(2000).nullable(),
  agree: z.boolean(),
});

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const limited = await rateLimit(req, "form");
  if (limited) return limited;
  const { token } = await params;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check your prices");
  if (!b.data.decline && !b.data.agree) return deny(400, "Please confirm the statement above the button");
  const r = await submitProQuote(token, b.data);
  return Response.json(r, { status: r.ok ? 200 : 400 });
}
