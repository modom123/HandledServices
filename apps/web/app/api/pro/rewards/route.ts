/*
 * FILE    : apps/web/app/api/pro/rewards/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_0418 UTC
 * PURPOSE : Pro Rewards for the signed-in pro (lib/rewards.ts).
 *             GET                                   — balance, pending, history, tier, milestones, catalog, orders
 *             POST { item_id, ship_to{name,line1,line2?,city,state,zip,phone?} } — redeem points for a reward
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { redeem, rewardsFor } from "@/lib/rewards";

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  return Response.json({ ok: true, ...(await rewardsFor(v.contractorId)) });
}

const Ship = z.object({ name: z.string().trim().min(2).max(120), line1: z.string().trim().min(3).max(200), line2: z.string().trim().max(200).optional().default(""),
  city: z.string().trim().min(2).max(80), state: z.string().trim().min(2).max(2), zip: z.string().trim().regex(/^\d{5}$/), phone: z.string().trim().max(30).optional().default("") });

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const b = z.object({ item_id: z.string().uuid(), ship_to: Ship }).safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Add a full shipping address");
  const r = await redeem(v.contractorId, b.data.item_id, b.data.ship_to, v.fullName ?? v.email);
  return Response.json(r, { status: r.ok ? 200 : 409 });
}
