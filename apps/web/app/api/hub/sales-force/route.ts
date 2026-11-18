/*
 * FILE    : apps/web/app/api/hub/sales-force/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-18_0105 UTC
 * PURPOSE : Hub → Sales Force (admins). POST JSON:
 *             { action: "join", partner_id, leader_code? }   — put a partner in the Sales Force (Associate AE)
 *             { action: "rank", partner_id, rank, note? }     — set a rank (e.g. approve VP); moving up pays the bonus once
 *             { action: "leader", partner_id, leader_id }     — whose team they're on (null = none)
 *             { action: "refresh" }                           — run the promotion check now
 */
import { z } from "zod";
import { RANK_ORDER } from "@handled/core";
import { ADMINS_ONLY, deny, getViewer, isAdmin } from "@/lib/auth";
import { joinSalesForce, refreshRanks, setLeader, setRank } from "@/lib/sales-force";
import type { SalesRank } from "@handled/core";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("join"), partner_id: z.string().uuid(), leader_code: z.string().max(20).nullable().optional() }),
  z.object({ action: z.literal("rank"), partner_id: z.string().uuid(), rank: z.string().refine((r) => (RANK_ORDER as string[]).includes(r)), note: z.string().max(500).nullable().optional() }),
  z.object({ action: z.literal("leader"), partner_id: z.string().uuid(), leader_id: z.string().uuid().nullable() }),
  z.object({ action: z.literal("refresh") }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isAdmin(v)) return deny(403, ADMINS_ONLY);
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check the request");
  const d = b.data;
  const r = d.action === "join" ? await joinSalesForce(d.partner_id, d.leader_code ?? null, v!.email ?? "admin")
    : d.action === "rank" ? await setRank(d.partner_id, d.rank as SalesRank, v!.email ?? "admin", d.note ?? "set in the Hub")
    : d.action === "leader" ? await setLeader(d.partner_id, d.leader_id)
    : { ok: true, ...(await refreshRanks()) };
  return Response.json(r, { status: r.ok ? 200 : 409 });
}
