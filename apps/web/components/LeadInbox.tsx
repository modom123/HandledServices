/*
 * FILE    : apps/web/components/LeadInbox.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0100 UTC
 * PURPOSE : Hub → Lead inbox: one tap to mark a lead contacted, booked, lost or spam.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = [["contacted", "📞 Contacted"], ["booked", "✅ Booked"], ["lost", "👎 Lost"], ["spam", "🚫 Spam"], ["new", "↩ New"]] as const;

export function LeadStatusButtons({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap gap-1">
      {STATUSES.filter(([s]) => s !== status).map(([s, label]) => (
        <button key={s} disabled={busy} className="rounded-full border border-line px-2 py-0.5 text-xs" onClick={async () => {
          setBusy(true);
          await fetch("/api/hub/inbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", id, status: s }) });
          setBusy(false); router.refresh();
        }}>{label}</button>
      ))}
    </div>
  );
}
