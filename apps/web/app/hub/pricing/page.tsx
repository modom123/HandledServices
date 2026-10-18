/*
 * FILE    : apps/web/app/hub/pricing/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-15_0200 UTC
 * PURPOSE : Mastermind → Growth → Pricing: one tab, two views — "Market pricing" (components/hub-views/MarketPricingView,
 *           formerly /hub/market; admins only, it shows its own notice to dispatchers) and "Accuracy check"
 *           (components/hub-views/PricingAccuracyView, formerly /hub/pricing-accuracy). Dispatchers open on the
 *           accuracy check.
 */
import { getViewer, isAdmin } from "@/lib/auth";
import { ViewSwitch, pickView, type View } from "@/components/ViewSwitch";
import MarketPricingView from "@/components/hub-views/MarketPricingView";
import PricingAccuracyView from "@/components/hub-views/PricingAccuracyView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pricing" };

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ view?: string; days?: string }> }) {
  const [sp, v] = await Promise.all([searchParams, getViewer()]);
  const views: readonly View[] = isAdmin(v) ? [["market", "Market pricing"], ["accuracy", "Accuracy check"]] : [["accuracy", "Accuracy check"], ["market", "Market pricing"]];
  const view = pickView(views, sp.view);
  return (
    <>
      <ViewSwitch base="/hub/pricing" views={views} current={view} />
      {view === "market" ? <MarketPricingView /> : <PricingAccuracyView searchParams={Promise.resolve(sp)} />}
    </>
  );
}
