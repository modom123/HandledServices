/*
 * FILE    : apps/web/app/hub/assistant/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 */
import { AssistantChat } from "@/components/HubActions";

export default function Assistant() {
  return (
    <div>
      <h1 className="text-2xl font-bold">AI operations assistant</h1>
      <p className="mb-4 text-sm text-ink-soft">Answers from live data. Can re-dispatch jobs, change statuses and pin alerts — every action is logged.</p>
      <AssistantChat />
    </div>
  );
}
