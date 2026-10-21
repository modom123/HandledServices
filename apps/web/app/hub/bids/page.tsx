/*
 * FILE    : apps/web/app/hub/bids/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-15_0200 UTC
 * PURPOSE : Mastermind → Clients → Bids & contracts: one tab, two views — "Our bids" (components/hub-views/BidsWorkspace)
 *           and "Find federal (SAM.gov)" (components/hub-views/GovOpportunities, formerly /hub/gov). Notice pages stay at
 *           /hub/gov/[id]; "Start a bid" there opens the bid here.
 */
import { ViewSwitch, pickView, type View } from "@/components/ViewSwitch";
import BidsWorkspace from "@/components/hub-views/BidsWorkspace";
import GovOpportunities from "@/components/hub-views/GovOpportunities";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bids & contracts" };

const VIEWS: readonly View[] = [["bids", "Our bids"], ["gov", "Find federal (SAM.gov)"]];
type SP = { view?: string; q?: string; type?: string; status?: string; year?: string; all?: string };

export default async function BidsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const view = pickView(VIEWS, sp.view);
  return (
    <>
      <ViewSwitch base="/hub/bids" views={VIEWS} current={view} />
      {view === "gov" ? <GovOpportunities searchParams={Promise.resolve(sp)} /> : <BidsWorkspace searchParams={Promise.resolve(sp)} />}
    </>
  );
}
