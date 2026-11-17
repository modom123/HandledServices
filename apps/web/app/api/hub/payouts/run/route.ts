/*
 * FILE    : apps/web/app/api/hub/payouts/run/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_1700 UTC
 * PURPOSE : Admins: pay pros now instead of waiting for Monday. POST JSON
 *             { action: "pay_pro", contractorId } — one pro's approved balance (Hub → Pros → pro → Pay now)
 *             { action: "pay_all" }               — everyone's (Hub → Money → Pay everyone now; same run as Monday)
 *           Same checks as the Monday run (Stripe readiness, available funds, claim-before-transfer); no pro emails on
 *           "not ready" here — staff see the reason on screen.
 */
import { z } from "zod";
import { ADMINS_ONLY, deny, getViewer, isAdmin } from "@/lib/auth";
import { payNow, runWeeklyPayouts } from "@/lib/pro-benefits";

export const maxDuration = 300;

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pay_pro"), contractorId: z.string().uuid() }),
  z.object({ action: z.literal("pay_all") }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isAdmin(v)) return deny(403, ADMINS_ONLY);
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check the request");
  if (b.data.action === "pay_all") return Response.json({ ok: true, ...(await runWeeklyPayouts(new Date(), { method: "manual", budgetMs: 240_000 })) });
  const r = await payNow(b.data.contractorId, v!.email ?? "admin");
  return Response.json({ ok: r.kind === "paid" || r.kind === "nothing", ...r });
}
