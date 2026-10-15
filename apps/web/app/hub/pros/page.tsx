/*
 * FILE    : apps/web/app/hub/pros/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-15_0200 UTC
 * PURPOSE : Mastermind → Pros → Roster: one tab, two views — "All pros" (components/hub-views/ProRoster) and
 *           "Health & 1099" (components/hub-views/NetworkHealth, formerly /hub/network).
 */
import { ViewSwitch, pickView, type View } from "@/components/ViewSwitch";
import ProRoster from "@/components/hub-views/ProRoster";
import NetworkHealth from "@/components/hub-views/NetworkHealth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pro roster" };

const VIEWS: readonly View[] = [["roster", "All pros"], ["health", "Health & 1099"]];

export default async function ProsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const view = pickView(VIEWS, (await searchParams).view);
  return (
    <>
      <ViewSwitch base="/hub/pros" views={VIEWS} current={view} />
      {view === "health" ? <NetworkHealth /> : <ProRoster />}
    </>
  );
}
