/*
 * FILE    : apps/web/app/hub/agents/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-15_0200 UTC
 * PURPOSE : Mastermind → AI team → AI agents & IEBC: one tab, two views — "Agents" (components/hub-views/AgentsView) and
 *           "IEBC Workforce" (components/hub-views/WorkforceView, formerly /hub/workforce: departments, autonomy,
 *           the approval queue and the activity log).
 */
import { ViewSwitch, pickView, type View } from "@/components/ViewSwitch";
import AgentsView from "@/components/hub-views/AgentsView";
import WorkforceView from "@/components/hub-views/WorkforceView";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI agents & IEBC" };

const VIEWS: readonly View[] = [["agents", "Agents"], ["workforce", "IEBC Workforce & approvals"]];

export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const view = pickView(VIEWS, (await searchParams).view);
  return (
    <>
      <ViewSwitch base="/hub/agents" views={VIEWS} current={view} />
      {view === "workforce" ? <WorkforceView /> : <AgentsView />}
    </>
  );
}
