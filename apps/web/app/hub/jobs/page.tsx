/*
 * FILE    : apps/web/app/hub/jobs/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-28_1735 UTC
 * PURPOSE : Mastermind → Jobs: one tab, three views of the same jobs — "List" (the dispatcher's board by time,
 *           components/hub-views/DispatchView, was /hub/dispatch), "Schedule" (a day as a grid per pro, ScheduleView, was
 *           /hub/schedule) and "Board" (kanban by status, JobsBoardView, was this page). Old addresses redirect here
 *           (next.config.ts). Job detail pages stay at /hub/jobs/<id>.
 */
import { ViewSwitch, pickView, type View } from "@/components/ViewSwitch";
import DispatchView from "@/components/hub-views/DispatchView";
import ScheduleView from "@/components/hub-views/ScheduleView";
import JobsBoardView from "@/components/hub-views/JobsBoardView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jobs" };

const VIEWS: readonly View[] = [["list", "List"], ["schedule", "Schedule"], ["board", "Board"]];

type SP = Record<string, string | undefined>;

export default async function JobsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const view = pickView(VIEWS, sp.view);
  const p = Promise.resolve(sp);
  return (
    <>
      <ViewSwitch base="/hub/jobs" views={VIEWS} current={view} />
      {view === "schedule" ? <ScheduleView searchParams={p} /> : view === "board" ? <JobsBoardView searchParams={p} /> : <DispatchView searchParams={p} />}
    </>
  );
}
