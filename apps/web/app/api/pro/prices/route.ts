/*
 * FILE    : apps/web/app/api/pro/prices/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0200 UTC
 * PURPOSE : The pro's price card. GET → their services, current %, minimum job and the local market.
 *           POST { items: [{ slug, pct (80–175 or null = Handled's price), min_job, active }] }.
 */
import { z } from "zod";
import { PRO_RATE_BAND } from "@handled/core";
import { deny, getViewer } from "@/lib/auth";
import { myRates, saveRates } from "@/lib/pro-prices";

const Body = z.object({ items: z.array(z.object({ slug: z.string().max(80), pct: z.number().int().min(PRO_RATE_BAND.min).max(PRO_RATE_BAND.max).nullable(), min_job: z.number().min(0).max(100000).nullable(), active: z.boolean() })).max(200) });

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny();
  return Response.json({ rates: await myRates(v.contractorId) });
}

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny();
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, `Prices go from ${PRO_RATE_BAND.min}% to ${PRO_RATE_BAND.max}% of Handled's price`);
  try { return Response.json({ ok: true, ...(await saveRates(v.contractorId, b.data.items)) }); }
  catch (e) { return deny(500, e instanceof Error ? e.message : "Couldn't save"); }
}
