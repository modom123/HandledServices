/*
 * FILE    : apps/web/components/Deductions.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_0120 UTC
 * PURPOSE : Proposed deductions (pro agreement §17): the pro's response form, and staff's
 *           uphold / waive buttons in Hub → Finance.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeductionResponse({ id, es = false }: { id: string; es?: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form className="card space-y-2 text-sm" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setMsg("");
      const r = await fetch(`/api/pro/deductions/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ response: text }) });
      const j = await r.json().catch(() => ({}));
      setBusy(false);
      if (r.ok) router.refresh(); else setMsg(j.error ?? (es ? "Inténtelo de nuevo" : "Try again"));
    }}>
      <div className="font-semibold">{es ? "Su versión" : "Your side"}</div>
      <textarea className="input min-h-28" required minLength={5} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)}
        placeholder={es ? "Qué pasó, por qué no fue su trabajo, fotos o mensajes que lo muestran…" : "What happened, why it wasn’t your workmanship, photos or messages that show it…"} />
      <button className="btn-primary w-full" disabled={busy || text.trim().length < 5}>{busy ? "…" : es ? "Enviar mi respuesta" : "Send my response"}</button>
      {msg && <p className="text-rose-700">{msg}</p>}
    </form>
  );
}

export function DeductionDecision({ id, canUphold }: { id: string; canUphold: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const decide = async (decision: "upheld" | "waived") => {
    const r = await fetch(`/api/hub/deductions/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, note }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) router.refresh(); else setMsg(j.error ?? "Failed");
  };
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input className="input w-64 text-xs" placeholder="Reason for the decision (sent to the pro)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="btn-ghost px-3 py-1 text-xs" disabled={!canUphold || note.length < 5} title={canUphold ? "" : "Wait for the pro's response or the deadline"} onClick={() => decide("upheld")}>Uphold</button>
      <button className="btn-ghost px-3 py-1 text-xs" onClick={() => decide("waived")}>Waive</button>
      {msg && <span className="text-xs text-rose-700">{msg}</span>}
    </div>
  );
}
