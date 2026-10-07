/*
 * FILE    : apps/web/app/api/cron/accounting/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-06_2210 UTC
 * PURPOSE : Vercel cron (daily, see vercel.json): push yesterday's Stripe activity and any new business invoices
 *           to Xero, and retry anything from the last 7 days that failed. Does nothing until Xero is connected.
 */
import { cronAuthorized } from "@/lib/cron-auth";
import { runAccountingSync } from "@/lib/accounting";

export const maxDuration = 300;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  const r = await runAccountingSync({ lookbackDays: 7 }).catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }));
  return Response.json(r);
}
