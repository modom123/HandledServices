/*
 * FILE    : apps/web/app/api/hub/pro-program/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-01_2124 UTC
 * PURPOSE : Staff: read and save the Pro Program policy — who qualifies for each benefit and its amounts.
 */
import { z } from "zod";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { getPolicy, savePolicy } from "@/lib/pro-benefits";

const rule = {
  enabled: z.boolean(), minTier: z.enum(["pro", "pro_plus", "elite"]), minJobs: z.number().int().min(0).max(1000),
  minRating: z.number().min(0).max(5), trades: z.array(z.string().max(40)).max(40),
};
const money = (max: number) => z.number().min(0).max(max);
const Policy = z.object({
  payProtection: z.object(rule),
  showUpPay: z.object({ ...rule, amount: money(49) }),
  instantPay: z.object({ ...rule, feePct: z.number().min(0.01).max(0.05), minFee: money(5), minAmount: money(500) }),
  insurance: z.object({ ...rule, stipend: money(1000), afterJobs: z.number().int().min(1).max(500),
    partners: z.array(z.object({ name: z.string().max(80), url: z.string().max(300), phone: z.string().max(40), covers: z.string().max(200), code: z.string().max(40) })).max(6) }),
  materials: z.object({ ...rule, autoApproveUpTo: money(1000), maxShareOfPrice: z.number().min(0.05).max(1), shoppingTrades: z.array(z.string().max(40)).max(40), shoppingMax: money(5000) }),
  guarantee: z.object({ ...rule, weeklyMinimum: money(5000), months: z.array(z.number().int().min(1).max(12)).max(12), minAcceptance: z.number().min(0).max(1),
    minDaysAvailable: z.number().int().min(0).max(7), weeklyBudget: money(100000) }),
});

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  return Response.json(await getPolicy());
}

export async function PUT(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  if (v!.role !== "admin") return deny(403, "Only an admin can change pro pay policy");
  const p = Policy.safeParse(await req.json().catch(() => null));
  if (!p.success) return deny(400, p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  return Response.json(await savePolicy(p.data, v!.fullName ?? v!.email ?? "admin"));
}
