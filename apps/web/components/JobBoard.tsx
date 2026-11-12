/*
 * FILE    : apps/web/components/JobBoard.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-04_2204 UTC
 * PURPOSE : "Jobs near you" (open job board, lib/board.ts): Take it → a 15-minute hold, then the usual offer
 *           page to read the full work order and accept. English and Spanish.
 * UPDATED : 2026-11-12_2100 UTC — BoardAlerts: the pro picks job alerts — all / daily summary / off.
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

/** Job alerts: instant for posts and top pay + a daily summary, the summary only, or off (direct offers still come). */
export function BoardAlerts({ pref, es }: { pref: "all" | "digest" | "off"; es: boolean }) {
  const router = useRouter();
  const [cur, setCur] = useState(pref);
  const [msg, setMsg] = useState("");
  const opts: ["all" | "digest" | "off", string][] = [["all", es ? "Todos" : "All"], ["digest", es ? "Resumen diario" : "Daily summary"], ["off", es ? "Apagados" : "Off"]];
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
      <span className="font-semibold">{es ? "Avisos de trabajos:" : "Job alerts:"}</span>
      {opts.map(([k, label]) => (
        <button key={k} type="button" className={`rounded-full border px-3 py-1 ${cur === k ? "border-brand bg-brand-tint font-semibold" : "border-line bg-white"}`} onClick={async () => {
          const prev = cur; setCur(k); setMsg("");
          const r = await fetch("/api/pro/board-alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pref: k }) }).catch(() => null);
          const j = r ? await r.json().catch(() => ({})) : {};
          if (!r?.ok) { setCur(prev); setMsg(String(j.error ?? (es ? "Intente de nuevo" : "Try again"))); return; }
          router.refresh();
        }}>{label}</button>
      ))}
      <span className="text-ink-soft">{cur === "all" ? (es ? "Mensaje al instante por trabajos publicados y de pago alto que le encajan, más un resumen diario." : "A text right away for posted and top-pay jobs that fit you, plus a daily summary.") : cur === "digest" ? (es ? "Un mensaje al día con los trabajos nuevos cerca de usted." : "One message a day with new jobs near you.") : (es ? "Sin avisos del tablero; las ofertas directas siguen llegando." : "No board alerts; direct job offers still come.")}</span>
      {msg && <span className="text-red-700">{msg}</span>}
    </div>
  );
}
