/*
 * FILE    : apps/web/components/HubBusiness.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-04_1934 UTC
 * PURPOSE : Hub → business account controls: terms (case by case, with a reason and credit limit),
 *           hold, priority, pilot, status, members, properties and dedicated pros.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BUSINESS_TERMS, TERMS_DAYS } from "@handled/core";

function useHub() {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (body: Record<string, unknown>, done?: () => void) => {
    setBusy(true); setMsg("");
    const r = await fetch("/api/hub/business", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok || j.ok === false) return setMsg(j.error ?? "Failed");
    done?.(); router.refresh();
  };
  return { msg, busy, run };
}

export function TermsControl({ id, mode, days, limit, note, hold }: { id: string; mode: string; days: number; limit: number; note: string | null; hold: boolean }) {
  const [m, setM] = useState(mode);
  const [d, setD] = useState(days || 30);
  const [l, setL] = useState(String(limit || BUSINESS_TERMS.defaultCreditLimit));
  const [n, setN] = useState(note ?? "");
  const { msg, busy, run } = useHub();
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-36" value={m} onChange={(e) => setM(e.target.value)}><option value="prepay">Prepay</option><option value="terms">Invoice on terms</option></select>
        {m === "terms" && <>
          <select className="input w-28" value={d} onChange={(e) => setD(Number(e.target.value))}>{TERMS_DAYS.map((x) => <option key={x} value={x}>Net {x}</option>)}</select>
          <label className="flex items-center gap-1">Credit limit $<input className="input w-28" inputMode="numeric" value={l} onChange={(e) => setL(e.target.value.replace(/[^\d]/g, ""))} /></label>
        </>}
      </div>
      <input className="input" placeholder={m === "terms" ? "Why this account gets terms (required): history, size, references, credit check" : "Note (optional)"} value={n} onChange={(e) => setN(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" disabled={busy} onClick={() => run({ action: "terms", id, billing_mode: m, terms_days: d, credit_limit: Number(l) || 0, note: n })}>Save billing</button>
        {mode === "terms" && <button className="btn-ghost" disabled={busy} onClick={() => run({ action: "hold", id, on: !hold })}>{hold ? "Lift hold" : "Put on hold"}</button>}
        {msg && <span className="text-rose-700">{msg}</span>}
      </div>
    </div>
  );
}

export function Toggle({ id, action, on, labels }: { id: string; action: "priority"; on: boolean; labels: [string, string] }) {
  const { msg, busy, run } = useHub();
  return <span><button className="btn-ghost px-3 py-1 text-xs" disabled={busy} onClick={() => run({ action, id, on: !on })}>{on ? labels[1] : labels[0]}</button>{msg && <span className="ml-1 text-xs text-rose-700">{msg}</span>}</span>;
}

export function PilotControl({ id, pct, jobs }: { id: string; pct: number; jobs: number }) {
  const [p, setP] = useState(String(pct));
  const [j, setJ] = useState(String(jobs));
  const { msg, busy, run } = useHub();
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label className="flex items-center gap-1"><input className="input w-16" inputMode="numeric" value={p} onChange={(e) => setP(e.target.value.replace(/\D/g, ""))} />% off</label>
      <label className="flex items-center gap-1">the next <input className="input w-14" inputMode="numeric" value={j} onChange={(e) => setJ(e.target.value.replace(/\D/g, ""))} /> jobs</label>
      <button className="btn-ghost px-3 py-1 text-xs" disabled={busy} onClick={() => run({ action: "pilot", id, pct: Math.min(BUSINESS_TERMS.maxPilotPct, Number(p) || 0), jobs: Math.min(BUSINESS_TERMS.maxPilotJobs, Number(j) || 0) })}>Save pilot</button>
      <span className="text-xs text-ink-soft">Max {BUSINESS_TERMS.maxPilotPct}% on {BUSINESS_TERMS.maxPilotJobs} jobs; always from our share, never the pro’s pay.</span>
      {msg && <span className="text-rose-700">{msg}</span>}
    </div>
  );
}

export function StatusSelect({ id, status }: { id: string; status: string }) {
  const { busy, run } = useHub();
  return <select className="input w-32" disabled={busy} value={status} onChange={(e) => run({ action: "status", id, status: e.target.value })}>{["lead", "proposal", "active", "paused", "lost"].map((s) => <option key={s}>{s}</option>)}</select>;
}

export function AddMemberHub({ id }: { id: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("booker");
  const { msg, busy, run } = useHub();
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <input className="input max-w-xs" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <select className="input w-28" value={role} onChange={(e) => setRole(e.target.value)}><option value="booker">booker</option><option value="admin">admin</option></select>
      <button className="btn-ghost px-3 py-1 text-xs" disabled={busy || !email.includes("@")} onClick={() => run({ action: "member", id, email, role }, () => setEmail(""))}>Add member</button>
      {msg && <span className="text-rose-700">{msg}</span>}
    </div>
  );
}

export function AddPropertyHub({ id }: { id: string }) {
  const blank = { name: "", address: "", city: "", state: "MI", zip: "", access_notes: "" };
  const [f, setF] = useState(blank);
  const { msg, busy, run } = useHub();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <input className="input w-40" placeholder="Name" value={f.name} onChange={set("name")} />
      <input className="input w-56" placeholder="Address" value={f.address} onChange={set("address")} />
      <input className="input w-32" placeholder="City" value={f.city} onChange={set("city")} />
      <input className="input w-14" value={f.state} onChange={set("state")} aria-label="State" />
      <input className="input w-24" placeholder="ZIP" value={f.zip} onChange={set("zip")} />
      <input className="input w-56" placeholder="Access notes" value={f.access_notes} onChange={set("access_notes")} />
      <button className="btn-ghost px-3 py-1 text-xs" disabled={busy || !/^\d{5}$/.test(f.zip) || f.name.length < 2} onClick={() => run({ action: "property", id, ...f, access_notes: f.access_notes || null }, () => setF(blank))}>Add property</button>
      {msg && <span className="text-rose-700">{msg}</span>}
    </div>
  );
}

export function DedicatedHub({ id, pros, current }: { id: string; pros: { id: string; name: string }[]; current: string[] }) {
  const [pick, setPick] = useState("");
  const { msg, busy, run } = useHub();
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap gap-2">{current.map((c) => <span key={c} className="rounded-full bg-brand-tint px-2.5 py-0.5 text-xs">{pros.find((p) => p.id === c)?.name ?? c} <button className="ml-1 text-rose-700" disabled={busy} onClick={() => run({ action: "dedicated", id, contractor_id: c, on: false })}>×</button></span>)}</div>
      <div className="flex flex-wrap items-center gap-2">
        <select className="input max-w-xs" value={pick} onChange={(e) => setPick(e.target.value)}><option value="">Add a dedicated pro…</option>{pros.filter((p) => !current.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <button className="btn-ghost px-3 py-1 text-xs" disabled={busy || !pick} onClick={() => run({ action: "dedicated", id, contractor_id: pick, on: true }, () => setPick(""))}>Add</button>
        {msg && <span className="text-rose-700">{msg}</span>}
      </div>
    </div>
  );
}

export function RunInvoices() {
  const { msg, busy, run } = useHub();
  return <span><button className="btn-ghost px-3 py-1 text-xs" disabled={busy} onClick={() => run({ action: "invoices" })}>Run invoices now</button>{msg && <span className="ml-1 text-xs text-rose-700">{msg}</span>}</span>;
}
