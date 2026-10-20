/*
 * FILE    : apps/web/app/api/quote-bids/[token]/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0200 UTC
 * PURPOSE : A pro's answer to a quote request, from their private link: { decline } or { pay, earliest_date, note }.
 */
import { z } from "zod";
import { submitBid } from "@/lib/quotes";

const Body = z.object({ decline: z.boolean().default(false), pay: z.number().min(1).max(250000).nullable().optional(), earliest_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), note: z.string().max(1000).nullable().optional() });

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return Response.json({ error: "Check your quote" }, { status: 400 });
  const r = await submitBid(token, { decline: b.data.decline, pay: b.data.pay ?? null, earliest_date: b.data.earliest_date ?? null, note: b.data.note ?? null });
  return r.ok ? Response.json(r) : Response.json({ error: r.error }, { status: 400 });
}
