/*
 * FILE    : apps/web/components/JobAccessEditor.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-12_0005 UTC
 * PURPOSE : Hub job page: view / edit the job's entry details (lockbox, key, key holder). Only the assigned pro sees them,
 *           while the job is assigned or in progress. Saves through PATCH /api/hub/jobs/[id] { access_info }.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function JobAccessEditor({ jobId, initial }: { jobId: string; initial: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false), [text, setText] = useState(initial ?? ""), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setMsg("");
    const r = await fetch(`/api/hub/jobs/${jobId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_info: text.trim() || null }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!r.ok) return setMsg(j.error ?? "Failed");
    setOpen(false); router.refresh();
  };
  return (
    <div className="text-sm">
      {!open ? (
        <div className="flex items-start justify-between gap-2">
          <p className="whitespace-pre-wrap">{initial ?? <span className="text-ink-soft">None on file.</span>}</p>
          <button className="text-xs font-semibold text-brand underline" onClick={() => setOpen(true)}>{initial ? "Edit" : "Add"}</button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea className="input min-h-20" maxLength={1500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Entry: side door · Key / lockbox: back porch, 4821 · Key holder: neighbor Pat (248) 555-0100" />
          <div className="flex gap-2"><button className="btn-primary h-9 py-0" disabled={busy} onClick={save}>Save</button><button className="btn-ghost h-9 py-0" onClick={() => setOpen(false)}>Cancel</button>{msg && <span className="text-xs text-rose-700">{msg}</span>}</div>
        </div>
      )}
    </div>
  );
}
