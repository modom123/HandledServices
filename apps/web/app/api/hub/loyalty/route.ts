/*
 * FILE    : apps/web/app/api/hub/loyalty/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-07_0530 UTC
 * PURPOSE : Hub → Handled Points (staff; settings: admin). POST JSON:
 *             { action: "settings", enabled, earnRate, pointValue, redeemStep, pendingDays, inactivityExpiryMonths, firstJobBonus, reviewBonus }
 *             { action: "adjust", business_id? | profile_id? | email?, points, note }
 *             { action: "run" }   — release pending points / review bonuses / expiry now
 */
import { z } from "zod";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adjustLoyalty, releaseLoyalty, saveLoyaltySettings } from "@/lib/loyalty";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("settings"), enabled: z.boolean(), earnRate: z.number().min(0).max(20), pointValue: z.number().min(0.001).max(1), redeemStep: z.number().int().min(50).max(100000),
    pendingDays: z.number().int().min(0).max(365), inactivityExpiryMonths: z.number().int().min(3).max(60), firstJobBonus: z.number().int().min(0).max(10000), reviewBonus: z.number().int().min(0).max(10000) }),
  z.object({ action: z.literal("adjust"), business_id: z.string().uuid().nullable().optional(), profile_id: z.string().uuid().nullable().optional(), email: z.string().trim().email().nullable().optional(),
    points: z.number().int().min(-1_000_000).max(1_000_000), note: z.string().trim().min(3).max(300) }),
  z.object({ action: z.literal("run") }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, b.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const d = b.data;
  const who = v!.fullName ?? v!.email;
  switch (d.action) {
    case "settings": {
      if (v!.role !== "admin") return deny(403, "Only an admin can do that");
      const { action: _a, ...s } = d;
      return Response.json({ ok: true, settings: await saveLoyaltySettings(s, who) });
    }
    case "adjust": {
      if (!d.business_id && !d.profile_id && !d.email) return deny(400, "Pick an account");
      const r = await adjustLoyalty(d.business_id ? { businessId: d.business_id } : { profileId: d.profile_id ?? null, email: d.email?.toLowerCase() ?? null }, d.points, d.note, who);
      return Response.json(r, { status: r.ok ? 200 : 409 });
    }
    case "run": return Response.json({ ok: true, result: await releaseLoyalty() });
  }
}
