/*
 * FILE    : apps/web/components/Checklist.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_0221 UTC
 * PURPOSE : Job checklist UI (format in packages/core/src/checklists.ts), English and Spanish:
 *             ChecklistPanel    — the pro checks items off, or marks N/A with the reason (job sheet)
 *             ChecklistView     — read-only, with what's done (work order preview, customer, Hub)
 *             CustomerRequests  — the customer adds / removes special requests before work starts
 *             StaffInstructions — staff add / remove special instructions (Hub job page)
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { checklistProgress, type ChecklistCheck, type ChecklistExtra, type JobChecklist } from "@handled/core";

const tx = (es: boolean, en: string, sp: string) => (es ? sp : en);

function Bar({ c, checks, es }: { c: JobChecklist; checks: ChecklistCheck[]; es: boolean }) {
  const p = checklistProgress(c, checks);
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-ink-soft"><span>{tx(es, `${p.done} done${p.na ? ` · ${p.na} N/A` : ""} · ${p.left} left`, `${p.done} hechos${p.na ? ` · ${p.na} N/A` : ""} · ${p.left} pendientes`)}</span><span>{p.pct}%</span></div>
      <div className="mt-1 h-2 rounded-full bg-paper"><div className="h-2 rounded-full bg-brand" style={{ width: `${p.pct}%` }} /></div>
      {p.open.length > 0 && <div className="mt-1 text-xs text-amber-700">{tx(es, `${p.open.length} required item(s) still open`, `${p.open.length} punto(s) obligatorio(s) pendiente(s)`)}</div>}
    </div>
  );
}

export function ChecklistPanel({ jobId, checklist, checks: initial, es, locked }: { jobId: string; checklist: JobChecklist; checks: ChecklistCheck[]; es: boolean; locked: boolean }) {
  const router = useRouter();
  const [checks, setChecks] = useState(initial);
  const [na, setNa] = useState<string | null>(null);
  const [why, setWhy] = useState("");
  const [msg, setMsg] = useState("");
  const by = new Map(checks.map((x) => [x.item_id, x]));
  async function set(item_id: string, status: "done" | "na" | "undo", note?: string) {
    setMsg("");
    const prev = checks;
    setChecks(status === "undo" ? checks.filter((x) => x.item_id !== item_id) : [...checks.filter((x) => x.item_id !== item_id), { item_id, status, note: note ?? null }]);
    const r = await fetch(`/api/pro/jobs/${jobId}/checklist`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item_id, status, note: note ?? null }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) { setChecks(prev); setMsg(String(j.error ?? tx(es, "Try again", "Intente de nuevo"))); } else router.refresh();
  }
  return (
    <div className="card space-y-4">
      <div><div className="font-semibold">✅ {es ? checklist.title_es : checklist.title}</div><p className="text-xs text-ink-soft">{tx(es, "What the customer booked, item by item. Check each one as it's done; anything that doesn't apply → N/A with the reason. Items marked * must be handled before you submit.", "Lo que reservó el cliente, punto por punto. Marque cada uno al terminarlo; lo que no aplique → N/A con el motivo. Los puntos con * deben quedar marcados antes de enviar.")}</p></div>
      <Bar c={checklist} checks={checks} es={es} />
      {checklist.sections.map((s) => (
        <div key={s.id}>
          <div className={`text-xs font-semibold uppercase tracking-wide ${s.id === "special" ? "text-amber-700" : "text-ink-soft"}`}>{es ? s.title_es : s.title}</div>
          <ul className="mt-1 space-y-1">
            {s.items.map((x) => {
              const k = by.get(x.id);
              return (
                <li key={x.id} className={`rounded-lg p-2 text-sm ${k?.status === "done" ? "bg-emerald-50" : k?.status === "na" ? "bg-paper" : s.id === "special" ? "bg-amber-50" : ""}`}>
                  <div className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1 h-4 w-4" disabled={locked} checked={k?.status === "done"} onChange={() => set(x.id, k?.status === "done" ? "undo" : "done")} />
                    <div className="flex-1">
                      <span className={k?.status === "na" ? "line-through text-ink-soft" : ""}>{es ? x.text_es : x.text}</span>{x.required && <span className="text-rose-700"> *</span>}{x.photo && " 📷"}
                      {x.from === "customer" && <span className="ml-1 rounded bg-sky-100 px-1 text-xs">{tx(es, "customer request", "solicitud del cliente")}</span>}
                      {k?.status === "na" && <div className="text-xs text-ink-soft">N/A: {k.note}</div>}
                    </div>
                    {!locked && !k && <button className="text-xs text-ink-soft underline" onClick={() => { setNa(x.id); setWhy(""); }}>N/A</button>}
                    {!locked && k?.status === "na" && <button className="text-xs text-ink-soft underline" onClick={() => set(x.id, "undo")}>{tx(es, "undo", "deshacer")}</button>}
                  </div>
                  {na === x.id && (
                    <div className="mt-2 flex gap-2">
                      <input className="input flex-1 text-xs" autoFocus placeholder={tx(es, "Why doesn't it apply? (e.g. no oven in the unit)", "¿Por qué no aplica? (p. ej. no hay horno)")} value={why} onChange={(e) => setWhy(e.target.value)} />
                      <button className="btn-ghost px-3 text-xs" disabled={why.trim().length < 3} onClick={() => { set(x.id, "na", why); setNa(null); }}>{tx(es, "Save", "Guardar")}</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {msg && <p className="text-sm text-rose-700">{msg}</p>}
    </div>
  );
}

export function ChecklistView({ checklist, checks, es, compact = false }: { checklist: JobChecklist; checks?: ChecklistCheck[]; es: boolean; compact?: boolean }) {
  const by = new Map((checks ?? []).map((x) => [x.item_id, x]));
  return (
    <div className="space-y-3 text-sm">
      {checks && <Bar c={checklist} checks={checks} es={es} />}
      {checklist.sections.map((s) => (
        <div key={s.id}>
          <div className={`text-xs font-semibold uppercase tracking-wide ${s.id === "special" ? "text-amber-700" : "text-ink-soft"}`}>{es ? s.title_es : s.title}</div>
          <ul className={`mt-1 ${compact ? "space-y-0.5" : "space-y-1"}`}>
            {s.items.map((x) => {
              const k = by.get(x.id);
              return <li key={x.id} className="flex gap-2"><span>{k?.status === "done" ? "✅" : k?.status === "na" ? "➖" : "☐"}</span><span className={k?.status === "na" ? "text-ink-soft" : ""}>{es ? x.text_es : x.text}{x.required && <span className="text-rose-700"> *</span>}{x.photo && " 📷"}{k?.status === "na" && k.note ? <span className="text-xs text-ink-soft"> — N/A: {k.note}</span> : null}</span></li>;
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function CustomerRequests({ jobId, extra, es, canEdit }: { jobId: string; extra: ChecklistExtra[]; es: boolean; canEdit: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const mine = extra.filter((x) => x.from === "customer");
  return (
    <div className="space-y-2 text-sm">
      {mine.map((x) => <div key={x.id} className="flex items-center justify-between gap-2 rounded-lg bg-sky-50 p-2"><span>{x.text}</span>{canEdit && <button className="text-xs underline" onClick={async () => { await fetch(`/api/account/jobs/${jobId}/requests?id=${x.id}`, { method: "DELETE" }); router.refresh(); }}>{tx(es, "Remove", "Quitar")}</button>}</div>)}
      {canEdit && mine.length < 5 && (
        <div className="flex gap-2">
          <input className="input flex-1" placeholder={tx(es, "e.g. Please use the side door · Skip the home office", "p. ej. Use la puerta lateral · No limpiar la oficina")} value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn-ghost" disabled={text.trim().length < 3} onClick={async () => {
            const r = await fetch(`/api/account/jobs/${jobId}/requests`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
            const j = await r.json().catch(() => ({}));
            if (r.ok && j.ok) { setText(""); setMsg(""); router.refresh(); } else setMsg(String(j.error ?? tx(es, "Try again", "Intente de nuevo")));
          }}>{tx(es, "Add", "Agregar")}</button>
        </div>
      )}
      <p className="text-xs text-ink-soft">{tx(es, "Requests go on your pro's checklist. Anything beyond what you booked needs a change order — your pro will ask first.", "Las solicitudes van a la lista de su profesional. Lo que exceda lo reservado requiere una orden de cambio; su profesional le preguntará primero.")}</p>
      {msg && <p className="text-rose-700">{msg}</p>}
    </div>
  );
}

export function StaffInstructions({ jobId, extra }: { jobId: string; extra: ChecklistExtra[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [req, setReq] = useState(true);
  const [msg, setMsg] = useState("");
  const call = async (body: Record<string, unknown>) => {
    const r = await fetch(`/api/hub/jobs/${jobId}/checklist`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.ok) { setMsg(""); router.refresh(); return true; } setMsg(String(j.error ?? "Failed")); return false;
  };
  return (
    <div className="space-y-2 text-sm">
      {extra.map((x) => <div key={x.id} className="flex items-center justify-between gap-2 rounded-lg bg-paper p-2"><span>{x.text}{x.required && <span className="text-rose-700"> *</span>} <span className="text-xs text-ink-soft">({x.from})</span></span><button className="text-xs underline" onClick={() => call({ action: "remove", id: x.id })}>Remove</button></div>)}
      <div className="flex flex-wrap gap-2">
        <input className="input flex-1" placeholder="Special instruction for the pro (e.g. Gate code 4411; use the side door)" value={text} onChange={(e) => setText(e.target.value)} />
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={req} onChange={(e) => setReq(e.target.checked)} /> required</label>
        <button className="btn-ghost" disabled={text.trim().length < 3} onClick={async () => { if (await call({ action: "add", text, required: req })) setText(""); }}>Add</button>
      </div>
      {msg && <p className="text-rose-700">{msg}</p>}
    </div>
  );
}
