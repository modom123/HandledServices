/*
 * FILE    : apps/web/components/Coverage.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-06_2120 UTC
 * PURPOSE : Hub controls for cancellations & coverage: call the next backup, offer to everyone, ask more backups,
 *           excuse an emergency cancel.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function post(body: unknown) {
  const r = await fetch("/api/hub/coverage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return r.ok ? null : String(j.error ?? "Failed");
}

export function CoverActions({ jobId, open }: { jobId: string; open: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const go = async (action: string, done: string) => { setBusy(action); const e = await post({ action, job_id: jobId }); setBusy(""); setMsg(e ?? done); router.refresh(); };
  return (
    <span className="flex flex-wrap items-center gap-2 text-xs">
      {open && <button className="btn-primary px-3 py-1 text-xs" disabled={!!busy} onClick={() => go("call_backup", "Next backup called")}>{busy === "call_backup" ? "Calling…" : "Call next backup"}</button>}
      {open && <button className="btn-ghost px-3 py-1 text-xs" disabled={!!busy} onClick={() => go("offer_all", "Offered to all nearby pros")}>Offer to everyone</button>}
      {!open && <button className="btn-ghost px-3 py-1 text-xs" disabled={!!busy} onClick={() => go("line_up", "Asked more backups")}>Ask more backups</button>}
      {msg && <span className="text-ink-soft">{msg}</span>}
    </span>
  );
}

export function ExcuseButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  return (
    <span className="text-xs">
      <button className="underline" onClick={async () => { const note = prompt("Why is this excused? (emergency, illness, weather, customer's fault…)"); if (!note || note.trim().length < 3) return; const e = await post({ action: "excuse", event_id: eventId, note }); setMsg(e ?? "Excused"); router.refresh(); }}>Excuse</button>
      {msg && <span className="ml-1 text-ink-soft">{msg}</span>}
    </span>
  );
}
