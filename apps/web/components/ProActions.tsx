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

/** Can't get in? Tell ops — they call the customer; a confirmed lockout pays show-up pay. */
export function LockoutReport({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  async function send() {
    const r = await fetch(`/api/pro/jobs/${jobId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "lockout", note }) });
    setMsg(r.ok ? "Sent — we're calling the customer now. Please wait 15 minutes on site." : ((await r.json().catch(() => ({}))).error ?? "Failed"));
  }
  if (!open) return <button className="btn-ghost w-full text-sm" onClick={() => setOpen(true)}>Can’t get in?</button>;
  return (
    <div className="card space-y-2 text-sm">
      <div className="font-semibold">Can’t get access</div>
      <textarea className="input min-h-20" placeholder="Knocked and called at 9:05, gate locked, no answer…" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="btn-primary w-full" disabled={note.length < 3} onClick={send}>Report no access</button>
      {msg && <p className="text-ink-soft">{msg}</p>}
    </div>
  );
}

/** Materials not included in the price: upload the receipt; reimbursed at cost once the customer pays. */
export function MaterialsForm({ jobId, allowed, reason }: { jobId: string; allowed: boolean; reason: string | null }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  if (!allowed) return <p className="text-xs text-ink-soft">Materials reimbursement: {reason}.</p>;
  return (
    <form className="card space-y-2 text-sm" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      const r = await fetch(`/api/pro/jobs/${jobId}/expenses`, { method: "POST", body: new FormData(e.currentTarget) });
      const j = await r.json().catch(() => ({}));
      setBusy(false);
      setMsg(r.ok ? (j.status === "pending" ? "Sent for approval." : "Approved — you’re reimbursed once the customer pays.") : j.error ?? "Failed");
      if (r.ok) { (e.target as HTMLFormElement).reset(); router.refresh(); }
    }}>
      <div className="font-semibold">Materials receipt</div>
      <p className="text-xs text-ink-soft">Parts not included in the price, at cost. Over the limit? Call us first — we’ll get the customer’s OK.</p>
      <div className="grid grid-cols-2 gap-2">
        <input name="amount" type="number" step="0.01" min="0.01" className="input" placeholder="$ amount" required />
        <input name="file" type="file" accept="image/*,application/pdf" className="input" required />
      </div>
      <input name="description" className="input" placeholder="What you bought (e.g. wax ring + supply line)" required />
      <button className="btn-primary w-full" disabled={busy}>{busy ? "Sending…" : "Submit receipt"}</button>
      {msg && <p className="text-ink-soft">{msg}</p>}
    </form>
  );
}

/** Instant pay: cash out the approved balance now, or set up Stripe payouts first. */
export function InstantPay({ balance, fee, allowed, reason, ready }: { balance: number; fee: number; allowed: boolean; reason: string | null; ready: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function go(setup = false) {
    setBusy(true);
    const r = await fetch("/api/pro/payouts/instant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setup }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (j.url) { window.location.href = j.url; return; }
    setMsg(r.ok ? `$${j.amount} sent. ${j.note}` : j.error ?? "Failed");
    router.refresh();
  }
  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between"><div className="font-semibold">⚡ Instant pay</div><div className="text-lg font-bold text-brand">${balance.toFixed(2)}</div></div>
      {!allowed ? <p className="text-sm text-ink-soft">Not available yet: {reason}. Approved payouts go out on the free weekly run.</p>
        : !ready ? <><p className="text-sm text-ink-soft">Connect a bank or debit card through Stripe once, then cash out any time.</p><button className="btn-primary w-full" disabled={busy} onClick={() => go(true)}>Set up instant pay</button></>
        : <><p className="text-sm text-ink-soft">Cash out now for a ${fee.toFixed(2)} fee, or wait for the free weekly payout.</p><button className="btn-primary w-full" disabled={busy || balance <= fee} onClick={() => go()}>{busy ? "Sending…" : `Cash out $${Math.max(0, balance - fee).toFixed(2)} now`}</button></>}
      {msg && <p className="text-sm text-ink-soft">{msg}</p>}
    </div>
  );
}
