/*
 * FILE    : apps/web/components/ProActions.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Pro actions: start job, complete with photos. (Offers are accepted on the
 *           offer page, which requires agreeing to the work order — see WorkOrderView.)
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StartJob({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function start() {
    setBusy(true);
    await fetch(`/api/pro/jobs/${jobId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start" }) });
    setBusy(false);
    router.refresh();
  }
  return <button className="btn-primary w-full py-3" disabled={busy} onClick={start}>I’ve arrived — start job</button>;
}

export function CompleteJob({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [photos, setPhotos] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const fd = new FormData();
    Array.from(files).slice(0, 8).forEach((f) => fd.append("photos", f));
    const res = await fetch("/api/uploads", { method: "POST", body: fd });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg(json.error);
    setPhotos((p) => [...p, ...json.paths]);
  }
  async function complete() {
    setBusy(true);
    const res = await fetch(`/api/pro/jobs/${jobId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete", photos, note: note || null }) });
    setBusy(false);
    if (!res.ok) return setMsg((await res.json()).error ?? "Failed");
    router.refresh();
  }
  return (
    <div className="card space-y-3">
      <div className="font-semibold">Finish the job</div>
      <p className="text-sm text-ink-soft">Upload clear “after” photos of every area you worked on. AI checks them and your payout is approved automatically when they pass.</p>
      <input type="file" accept="image/*" capture="environment" multiple onChange={(e) => upload(e.target.files)} className="text-sm" />
      <div className="text-xs text-ink-soft">{photos.length} photo(s) uploaded</div>
      <textarea className="input" placeholder="Note for the customer (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      {msg && <p className="text-sm text-rose-700">{msg}</p>}
      <button className="btn-primary w-full py-3" disabled={busy || !photos.length} onClick={complete}>{busy ? "Working…" : "Mark complete"}</button>
    </div>
  );
}
