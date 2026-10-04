/*
 * FILE    : apps/web/components/JobBoard.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-04_2204 UTC
 * PURPOSE : "Jobs near you" (open job board, lib/board.ts): Take it → a 15-minute hold, then the usual offer
 *           page to read the full work order and accept. English and Spanish.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ClaimButton({ jobId, offerId, es }: { jobId: string; offerId: string | null; es: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  if (offerId) return <a href={`/pro/offers/${offerId}`} className="btn-primary px-5">{es ? "Ver y aceptar →" : "View & accept →"}</a>;
  return (
    <div className="text-right">
      <button className="btn-primary px-5" disabled={busy} onClick={async () => {
        setBusy(true); setMsg("");
        const r = await fetch("/api/pro/board", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ job_id: jobId }) });
        const j = await r.json().catch(() => ({}));
        setBusy(false);
        if (r.ok && j.offerId) router.push(`/pro/offers/${j.offerId}`);
        else { setMsg(String(j.error ?? (es ? "Intente de nuevo" : "Try again"))); router.refresh(); }
      }}>{busy ? "…" : es ? "Tomarlo →" : "Take it →"}</button>
      {msg && <div className="mt-1 max-w-xs text-xs text-red-700">{msg}</div>}
    </div>
  );
}
