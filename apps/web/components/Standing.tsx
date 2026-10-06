/*
 * FILE    : apps/web/components/Standing.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0123 UTC
 * PURPOSE : Pro standing UI (Pro Deactivation Policy): the pro's appeal form and "hand back this
 *           job" button; staff's standing actions and "record no-show".
 * UPDATED : 2026-10-06_1950 UTC — hand-back shows exactly what this cancel means now (free / short notice / late).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, error: j.error as string | undefined, late: j.late as boolean | undefined };
}

export function AppealForm({ es = false }: { es?: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <form className="mt-3 space-y-2" onSubmit={async (e) => { e.preventDefault(); const r = await post("/api/pro/standing", { appeal: text }); if (r.ok) router.refresh(); else setMsg(r.error ?? "Try again"); }}>
      <textarea className="input min-h-24" required minLength={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={es ? "Por qué la decisión debería cambiar — hechos, fechas, mensajes…" : "Why the decision should change — facts, dates, messages…"} />
      <button className="btn-primary" disabled={text.trim().length < 10}>{es ? "Enviar apelación" : "Send appeal"}</button>
      {msg && <p className="text-sm text-rose-700">{msg}</p>}
    </form>
  );
}

export function ReleaseJob({ jobId, es = false, notice }: { jobId: string; es?: boolean; notice?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  if (!open) return <button className="text-sm text-ink-soft underline" onClick={() => setOpen(true)}>{es ? "¿No puede hacerlo? Devolver este trabajo" : "Can’t make it? Hand this job back"}</button>;
  return (
    <div className="card space-y-2 text-sm">
      <p className="text-ink-soft">{notice ?? (es ? "Llamamos a su respaldo de inmediato." : "We call your backup right away.")}</p>
      <p className="text-xs text-ink-soft">{es ? "Gratis con 24 h+ · 6–24 h: poca anticipación, sin penalidad · menos de 6 h: cancelación tardía. Nunca hay cargo a su pago." : "24h+ out: free · 6–24h: short notice, no penalty · under 6h: late cancel. Never a charge to your pay."}</p>
      <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={es ? "Motivo (lo vemos solo nosotros)" : "Reason (only we see it)"} />
      <button className="btn-ghost w-full" disabled={reason.trim().length < 3} onClick={async () => { const r = await post(`/api/pro/jobs/${jobId}`, { action: "release", reason }); if (r.ok) router.push("/pro"); else setMsg(r.error ?? "Try again"); }}>{es ? "Devolver el trabajo" : "Hand it back"}</button>
      {msg && <p className="text-rose-700">{msg}</p>}
    </div>
  );
}

export function StandingActions({ contractorId, appealOpen }: { contractorId: string; appealOpen: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const act = async (action: string) => {
    if (action === "suspend" && !confirm("Suspend now? Only for a credible safety threat or suspected fraud.")) return;
    if (action === "deactivate" && !confirm("Deactivate? They get the reason in writing and can appeal within 14 days.")) return;
    const r = await post(`/api/hub/contractors/${contractorId}/standing`, { action, reason });
    if (r.ok) { setReason(""); router.refresh(); } else setMsg(r.error ?? "Failed");
  };
  return (
    <div className="space-y-2 text-sm">
      <textarea className="input min-h-16" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Written reason — sent to the pro (required)" />
      <div className="flex flex-wrap gap-2">
        {["warn", "suspend", "deactivate", "reinstate"].map((a) => <button key={a} className="btn-ghost px-3 py-1 text-xs capitalize" disabled={reason.trim().length < 10} onClick={() => act(a)}>{a}</button>)}
        {appealOpen && <button className="btn-ghost px-3 py-1 text-xs" disabled={reason.trim().length < 10} onClick={() => act("uphold_appeal")}>Keep decision (answer appeal)</button>}
      </div>
      {msg && <p className="text-rose-700">{msg}</p>}
    </div>
  );
}

export function NoShowButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  if (!open) return <button className="text-xs text-rose-700 underline" onClick={() => setOpen(true)}>Record pro no-show</button>;
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      <input className="input flex-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened (checked with the customer?) — the pro sees this" />
      <button className="btn-ghost px-3" disabled={note.trim().length < 5} onClick={async () => { const r = await post(`/api/hub/jobs/${jobId}/no-show`, { note }); if (r.ok) router.refresh(); else setMsg(r.error ?? "Failed"); }}>Record &amp; re-dispatch</button>
      {msg && <span className="text-rose-700">{msg}</span>}
    </div>
  );
}
