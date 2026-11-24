/*
 * FILE    : apps/web/app/api/cron/payouts/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_1700 UTC
 * PURPOSE : Mondays 15:00 UTC (vercel.json): the weekly pro payout run on its own, with the full time limit — repairs any
 *           interrupted payout first, then pays every pro's approved balance, 6 at a time, stopping new ones before the
 *           limit (anyone not reached stays approved; Hub → Money → "Pay everyone now" finishes it). lib/pro-benefits.ts.
 *           Only Vercel Cron / the GitHub Action (CRON_SECRET) may call it.
 */
import { runWeeklyPayouts } from "@/lib/pro-benefits";
import { cronAuthorized } from "@/lib/cron-auth";

export const maxDuration = 300;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  return Response.json(await runWeeklyPayouts(new Date(), { method: "weekly", budgetMs: 240_000 }));
}
