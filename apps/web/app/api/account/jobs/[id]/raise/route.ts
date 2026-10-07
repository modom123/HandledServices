/*
 * FILE    : apps/web/app/api/account/jobs/[id]/raise/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_0149 UTC
 * PURPOSE : The customer raises their offer ({ price }) or accepts a pro's counter
 *           ({ counter_offer_id }). Only the difference is charged (saved card, else a link).
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { startRaise } from "@/lib/market";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in first");
  const { id } = await ctx.params;
  const { data: mine } = await v.db.from("jobs").select("id").eq("id", id).eq("customer_id", v.userId).maybeSingle(); // the customer only: RLS also lets an offered or assigned pro read the job
  if (!mine) return deny(404, "Not found");
  const b = z.object({ price: z.coerce.number().min(1).max(10_000_000).optional(), counter_offer_id: z.string().uuid().optional() }).safeParse(await req.json().catch(() => null));
  if (!b.success || (!b.data.price && !b.data.counter_offer_id)) return deny(400, "Enter your new price");
  const r = await startRaise(id, null, { newPrice: b.data.price, counterOfferId: b.data.counter_offer_id });
  return r.ok ? Response.json(r) : deny(409, r.error);
}
