/*
 * FILE    : apps/web/components/BizLeadAdmin.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-04_1934 UTC
 * PURPOSE : Hub → Business leads controls: engine settings (on/off, volume, segments, pilot offer),
 *           run now, and lead outcomes from calls.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BIZ_SEGMENTS, BUSINESS_TERMS, type BizSegment } from "@handled/core";

async function post(body: unknown) {
  const r = await fetch("/api/hub/biz-leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return r.ok ? null : String(j.error ?? "Failed");
}

export function BizLeadSettingsForm({ s }: { s: { enabled: boolean; discover_per_day: number; emails_per_day: number; segments: BizSegment[]; pilot_pct: number; pilot_jobs: number } }) {
  const router = useRouter();
  const [f, setF] = useState(s);
  const [msg, setMsg] = useState("");
  return (
    <div className="space-y-3 text-sm">
      <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} /> Engine on (weekdays, with the pro lead engine)</label>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-1">Searches/day <input className="input w-16" inputMode="numeric" value={f.discover_per_day} onChange={(e) => setF({ ...f, discover_per_day: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></label>
        <label className="flex items-center gap-1">New sequences/day <input className="input w-16" inputMode="numeric" value={f.emails_per_day} onChange={(e) => setF({ ...f, emails_per_day: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></label>
        <label className="flex items-center gap-1">Pilot <input className="input w-14" inputMode="numeric" value={f.pilot_pct} onChange={(e) => setF({ ...f, pilot_pct: Math.min(BUSINESS_TERMS.maxPilotPct, Number(e.target.value.replace(/\D/g, "")) || 0) })} />% off the first <input className="input w-12" inputMode="numeric" value={f.pilot_jobs} onChange={(e) => setF({ ...f, pilot_jobs: Math.min(BUSINESS_TERMS.maxPilotJobs, Number(e.target.value.replace(/\D/g, "")) || 0) })} /> jobs</label>
      </div>
      <div className="flex flex-wrap gap-3">{(Object.keys(BIZ_SEGMENTS) as BizSegment[]).map((k) => (
        <label key={k} className="flex items-center gap-1"><input type="checkbox" checked={f.segments.includes(k)} onChange={(e) => setF({ ...f, segments: e.target.checked ? [...f.segments, k] : f.segments.filter((x) => x !== k) })} />{BIZ_SEGMENTS[k].label}</label>
      ))}</div>
      <div className="flex gap-2">
        <button className="btn-primary" onClick={async () => { const e = await post({ action: "settings", ...f }); setMsg(e ?? "Saved"); router.refresh(); }}>Save</button>
        <button className="btn-ghost" onClick={async () => { setMsg("Running…"); const e = await post({ action: "run" }); setMsg(e ?? "Done"); router.refresh(); }}>Run now</button>
        {msg && <span className="self-center text-ink-soft">{msg}</span>}
      </div>
    </div>
  );
}

export function BizLeadStatus({ id }: { id: string }) {
  const router = useRouter();
  return (
    <select className="input w-40 text-xs" defaultValue="" onChange={async (e) => { if (!e.target.value) return; await post({ action: "status", id, status: e.target.value }); router.refresh(); }}>
      <option value="">Mark…</option><option value="replied">Talking / interested</option><option value="queued">Email them</option><option value="call">Call list</option><option value="not_interested">Not interested</option><option value="do_not_contact">Do not contact</option>
    </select>
  );
}
