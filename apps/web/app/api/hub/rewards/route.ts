/*
 * FILE    : apps/web/app/api/hub/rewards/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_0418 UTC
 * PURPOSE : Hub → Rewards (staff; settings and forfeits: admin). POST JSON:
 *             { action: "settings", enabled, earnRate, pointValue, pendingDays, inactivityExpiryMonths, qualityMultiplier, minRatingForQuality }
 *             { action: "item", id?, name, name_es?, category, points, cost_usd, description?, description_es?, image_url?, stock?, active, sort? }
 *             { action: "order", id, status, tracking?, note? }
 *             { action: "adjust", contractor_id, points, note }   · { action: "forfeit", contractor_id, note }
 *             { action: "run" }                                    — release pending points / milestones now
 */
import { z } from "zod";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { adjustPoints, forfeitPoints, releaseRewards, saveRewardSettings, setRedemptionStatus } from "@/lib/rewards";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("settings"), enabled: z.boolean(), earnRate: z.number().min(0).max(100), pointValue: z.number().min(0.001).max(1), pendingDays: z.number().int().min(0).max(365),
    inactivityExpiryMonths: z.number().int().min(3).max(60), qualityMultiplier: z.number().min(1).max(3), minRatingForQuality: z.number().min(1).max(5) }),
  z.object({ action: z.literal("item"), id: z.string().uuid().optional(), name: z.string().trim().min(2).max(120), name_es: z.string().trim().max(120).nullable().optional(),
    category: z.enum(["merch", "gift_card", "tools", "electronics", "travel", "experience"]), points: z.number().int().min(1).max(10_000_000), cost_usd: z.number().min(0).max(100000),
    description: z.string().max(500).nullable().optional(), description_es: z.string().max(500).nullable().optional(), image_url: z.string().url().nullable().optional().or(z.literal("")),
    stock: z.number().int().min(0).nullable().optional(), active: z.boolean(), sort: z.number().int().optional() }),
  z.object({ action: z.literal("order"), id: z.string().uuid(), status: z.enum(["approved", "ordered", "shipped", "delivered", "cancelled"]), tracking: z.string().max(200).nullable().optional(), note: z.string().max(500).nullable().optional() }),
  z.object({ action: z.literal("adjust"), contractor_id: z.string().uuid(), points: z.number().int().min(-1_000_000).max(1_000_000), note: z.string().min(3).max(300) }),
  z.object({ action: z.literal("forfeit"), contractor_id: z.string().uuid(), note: z.string().min(3).max(300) }),
  z.object({ action: z.literal("run") }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, b.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const d = b.data;
  const who = v!.fullName ?? v!.email;
  if ((d.action === "settings" || d.action === "forfeit") && v!.role !== "admin") return deny(403, "Only an admin can do that");
  switch (d.action) {
    case "settings": { const { action: _a, ...s } = d; return Response.json({ ok: true, settings: await saveRewardSettings(s, who) }); }
    case "item": {
      const { action: _a, id, ...row } = d;
      const clean = { ...row, image_url: row.image_url || null };
      const { error } = id ? await adminClient().from("reward_catalog").update(clean).eq("id", id) : await adminClient().from("reward_catalog").insert(clean);
      return error ? deny(500, error.message) : Response.json({ ok: true });
    }
    case "order": { const r = await setRedemptionStatus(d.id, d.status, who, { tracking: d.tracking ?? null, note: d.note ?? null }); return Response.json(r, { status: r.ok ? 200 : 409 }); }
    case "adjust": { const r = await adjustPoints(d.contractor_id, d.points, d.note, who); return Response.json(r, { status: r.ok ? 200 : 409 }); }
    case "forfeit": return Response.json(await forfeitPoints(d.contractor_id, d.note, who));
    case "run": return Response.json({ ok: true, result: await releaseRewards() });
  }
}
