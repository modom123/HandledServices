/*
 * FILE    : apps/web/components/FastTrack.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_1311 UTC
 * PURPOSE : Proven-skill fast track: the pro's application form (portfolio upload, years, summary,
 *           references; English and Spanish) and the Hub decision buttons.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FAST_TRACK, TRADES, t as tr } from "@handled/core";

export function FastTrackApply({ es, trades }: { es: boolean; trades: string[] }) {
  const router = useRouter();
  const [photos, setPhotos] = useState<string[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [years, setYears] = useState("");
  const [summary, setSummary] = useState("");
  const [refs, setRefs] = useState("");
  const [picked, setPicked] = useState<string[]>(trades.slice(0, 1));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setMsg("");
    const list = Array.from(files).slice(0, FAST_TRACK.maxPhotos - photos.length);
    const fd = new FormData();
    list.forEach((f) => fd.append("photos", f));
    const res = await fetch("/api/uploads", { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(j.error ?? (es ? "No se pudieron subir las fotos" : "Upload failed"));
    setPhotos([...photos, ...(j.paths ?? [])]);
    setPreviews([...previews, ...list.map((f) => URL.createObjectURL(f))]);
  }
  async function send() {
    setBusy(true); setMsg("");
    const res = await fetch("/api/pro/fast-track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ years: Number(years) || 0, summary, references: refs, trades: picked, photos }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || j.ok === false) return setMsg(j.error ?? "Try again");
    router.refresh();
  }
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
        <input className="input" inputMode="numeric" placeholder={es ? "Años en el oficio" : "Years in the trade"} value={years} onChange={(e) => setYears(e.target.value.replace(/\D/g, ""))} />
        {trades.length > 1 ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">{trades.map((t) => <label key={t} className="flex items-center gap-1"><input type="checkbox" checked={picked.includes(t)} onChange={(e) => setPicked(e.target.checked ? [...picked, t] : picked.filter((x) => x !== t))} />{tr(es ? "es" : "en", TRADES.find((x) => x.id === t)?.label ?? t)}</label>)}</div>
        ) : <div />}
      </div>
      <textarea className="input min-h-28" placeholder={es ? "Cuéntenos de su experiencia: qué tipo de trabajos hace, dónde aprendió, trabajos de los que está orgulloso. Puede escribir en español." : "Tell us about your experience: the work you do, where you learned, jobs you’re proud of."} value={summary} onChange={(e) => setSummary(e.target.value)} />
      <input className="input" placeholder={es ? "Referencias (opcional): clientes o contratistas, con teléfono" : "References (optional): customers or contractors, with phone"} value={refs} onChange={(e) => setRefs(e.target.value)} />
      <div>
        <div className="text-sm font-semibold">{es ? `Fotos de su trabajo (${FAST_TRACK.minPhotos} a ${FAST_TRACK.maxPhotos})` : `Photos of your work (${FAST_TRACK.minPhotos}–${FAST_TRACK.maxPhotos})`}</div>
        <p className="text-xs text-ink-soft">{es ? "Antes y después funciona mejor. Solo el trabajo: sin personas, documentos ni direcciones." : "Before-and-after works best. The work only: no people, documents or addresses."}</p>
        {previews.length > 0 && <div className="mt-2 grid grid-cols-5 gap-2">{previews.map((u) => <img key={u} src={u} alt="" className="aspect-square rounded-lg object-cover" />)}</div>}
        {photos.length < FAST_TRACK.maxPhotos && <input type="file" accept="image/*" multiple className="mt-2 text-sm" disabled={busy} onChange={(e) => upload(e.target.files)} />}
      </div>
      <button className="btn-primary" disabled={busy || photos.length < FAST_TRACK.minPhotos || !years || summary.trim().length < 40} onClick={send}>{busy ? "…" : es ? "Enviar solicitud" : "Send application"}</button>
      {msg && <p className="text-sm text-rose-700">{msg}</p>}
    </div>
  );
}

export function FastTrackReview({ contractorId, status, trialDone }: { contractorId: string; status: string; trialDone: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async (action: "trial" | "approve" | "decline") => {
    setBusy(true); setMsg("");
    const r = await fetch("/api/hub/fast-track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contractor_id: contractorId, action, note: note || null }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok || j.ok === false) return setMsg(j.error ?? "Failed");
    router.refresh();
  };
  if (!["applied", "trial"].includes(status)) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input className="input max-w-sm text-sm" placeholder="Note (required to decline; the pro sees it)" value={note} onChange={(e) => setNote(e.target.value)} />
      {status === "applied" && <button className="btn-primary px-3 py-1 text-sm" disabled={busy} onClick={() => go("trial")}>Start trial job</button>}
      {status === "trial" && <button className="btn-primary px-3 py-1 text-sm" disabled={busy || !trialDone} title={trialDone ? "" : "After the trial job is completed"} onClick={() => go("approve")}>Approve: Pro+</button>}
      <button className="btn-ghost px-3 py-1 text-sm" disabled={busy} onClick={() => go("decline")}>Decline</button>
      {msg && <span className="text-sm text-rose-700">{msg}</span>}
    </div>
  );
}
