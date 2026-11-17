/*
 * FILE    : apps/web/components/WalkthroughAdmin.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2350 UTC
 * PURPOSE : Hub → Walkthroughs controls: close one out (done + follow-up email with the order link, no-show, cancel),
 *           who's going and notes; booking hours and days (admins).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WalkthroughSettings } from "@handled/core";

async function post(body: Record<string, unknown>) {
  const r = await fetch("/api/hub/walkthroughs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return r.ok && j.ok !== false ? null : String(j.error ?? "Failed");
}

export function WalkthroughRowActions({ id, status, notes, assigned, followedUp }: { id: string; status: string; notes: string | null; assigned: string | null; followedUp: boolean }) {
  const router = useRouter();
  const [n, setN] = useState(notes ?? "");
  const [who, setWho] = useState(assigned ?? "");
  const [msg, setMsg] = useState("");
  const act = async (body: Record<string, unknown>, ok: string) => { const e = await post({ action: "update", id, ...body }); setMsg(e ?? ok); router.refresh(); };
  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap gap-2">
        <input className="input w-40 text-xs" placeholder="Who’s going" value={who} onChange={(e) => setWho(e.target.value)} onBlur={() => who !== (assigned ?? "") && act({ assigned_to: who || null }, "Saved")} />
        {status === "booked" && <>
          <button className="btn-primary px-3 py-1 text-xs" onClick={() => act({ status: "done", follow_up: true, staff_notes: n || null }, followedUp ? "Done" : "Done — follow-up email with the order link sent")}>Done + send order link</button>
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => act({ status: "done", staff_notes: n || null }, "Done")}>Done</button>
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => act({ status: "no_show", staff_notes: n || null }, "Marked no-show — call them to rebook")}>No-show</button>
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => { if (confirm("Cancel it? They get an email with a link to rebook.")) act({ status: "cancelled", staff_notes: n || null }, "Cancelled"); }}>Cancel</button>
        </>}
      </div>
      <textarea className="input h-14 text-xs" placeholder="Notes: scope, sizes, who decides, next step" value={n} onChange={(e) => setN(e.target.value)} onBlur={() => n !== (notes ?? "") && act({ staff_notes: n || null }, "Notes saved")} />
      {msg && <div className="text-ink-soft">{msg}</div>}
    </div>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const toMin = (v: string) => { const [h, m] = v.split(":").map(Number); return (h || 0) * 60 + (m || 0); };

export function WalkthroughSettingsForm({ s }: { s: WalkthroughSettings & { notify_emails: string | null } }) {
  const router = useRouter();
  const [f, setF] = useState(s);
  const [msg, setMsg] = useState("");
  const num = (k: keyof WalkthroughSettings, max: number) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Math.min(max, Number(e.target.value.replace(/\D/g, "")) || 0) });
  return (
    <div className="space-y-3 text-sm">
      <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} /> Businesses can book online</label>
      <div className="flex flex-wrap gap-3">{DAYS.map((d, i) => <label key={d} className="flex items-center gap-1"><input type="checkbox" checked={f.days.includes(i)} onChange={(e) => setF({ ...f, days: e.target.checked ? [...f.days, i].sort() : f.days.filter((x) => x !== i) })} />{d}</label>)}</div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-1">From <input type="time" className="input w-auto" value={hhmm(f.start_min)} onChange={(e) => setF({ ...f, start_min: toMin(e.target.value) })} /></label>
        <label className="flex items-center gap-1">to <input type="time" className="input w-auto" value={hhmm(f.end_min)} onChange={(e) => setF({ ...f, end_min: toMin(e.target.value) })} /></label>
        <label className="flex items-center gap-1">Every <input className="input w-16" inputMode="numeric" value={f.slot_minutes} onChange={num("slot_minutes", 240)} /> min</label>
        <label className="flex items-center gap-1" title="How many walkthroughs can happen at the same time (people who can go)">Per time <input className="input w-14" inputMode="numeric" value={f.per_slot} onChange={num("per_slot", 20)} /></label>
        <label className="flex items-center gap-1">At least <input className="input w-14" inputMode="numeric" value={f.lead_hours} onChange={num("lead_hours", 168)} /> hours ahead</label>
        <label className="flex items-center gap-1">Up to <input className="input w-14" inputMode="numeric" value={f.horizon_days} onChange={num("horizon_days", 60)} /> days out</label>
        <label className="flex items-center gap-1">Time zone <select className="input w-auto" value={f.time_zone} onChange={(e) => setF({ ...f, time_zone: e.target.value })}>{["America/Detroit", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles"].map((z) => <option key={z}>{z}</option>)}</select></label>
      </div>
      <input className="input" placeholder="Email new bookings to (comma-separated; default: OPS_EMAIL)" value={f.notify_emails ?? ""} onChange={(e) => setF({ ...f, notify_emails: e.target.value })} />
      <div className="flex items-center gap-2">
        <button className="btn-primary" onClick={async () => { const e = await post({ action: "settings", ...f, notify_emails: f.notify_emails || null }); setMsg(e ?? "Saved"); router.refresh(); }}>Save</button>
        {msg && <span className="text-ink-soft">{msg}</span>}
      </div>
    </div>
  );
}
