/*
 * FILE    : apps/web/app/hub/money/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-28_1735 UTC
 * PURPOSE : Mastermind → Money: one tab, three views — "Jobs & payouts" (each job's money and the one payout queue,
 *           components/hub-views/MoneyJobsView, admins), "Money in & out" (unpaid jobs, balances, failed payments,
 *           invoices, refunds — MoneyFlowView, was /hub/payments, all staff) and "Unit economics" (margin by service,
 *           deductions, pricing accuracy — EconomicsView, was /hub/finance, admins). Dispatchers see only Money in & out.
 */
import { ViewSwitch, pickView, type View } from "@/components/ViewSwitch";
import { getViewer, isAdmin } from "@/lib/auth";
import MoneyJobsView from "@/components/hub-views/MoneyJobsView";
import MoneyFlowView from "@/components/hub-views/MoneyFlowView";
import EconomicsView from "@/components/hub-views/EconomicsView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Money" };

const ALL: readonly View[] = [["jobs", "Jobs & payouts"], ["flow", "Money in & out"], ["economics", "Unit economics"]];
const STAFF: readonly View[] = [["flow", "Money in & out"]];

export default async function MoneyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const views = isAdmin(await getViewer()) ? ALL : STAFF;
  const view = pickView(views, sp.view);
  const p = Promise.resolve(sp);
  return (
    <>
      {views.length > 1 && <ViewSwitch base="/hub/money" views={views} current={view} />}
      {view === "flow" ? <MoneyFlowView /> : view === "economics" ? <EconomicsView /> : <MoneyJobsView searchParams={p} />}
    </>
  );
}
