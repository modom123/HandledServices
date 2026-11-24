/*
 * FILE    : apps/web/components/WalkthroughAdmin.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2350 UTC
 * PURPOSE : Hub → Walkthroughs controls: close one out (Done emails the order link, No-show, Cancel); booking hours (admins).
 * UPDATED : 2026-11-18_0015 UTC — trimmed: three buttons per walkthrough; days and hours up front, the rest under More options.
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

/** Three buttons. "Done" always emails them the order link (once). */
export function WalkthroughRowActions({ id }: { id: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const act = async (status: string, ok: string) => { const e = await post({ action: "update", id, status, follow_up: status === "done" }); setMsg(e ?? ok); router.refresh(); };
  if (msg) return <span className="text-xs text-ink-soft">{msg}</span>;
  return (
    <div className="flex flex-wrap gap-2">
      <button className="btn-primary px-3 py-1 text-xs" onClick={() => act("done", "Done — order link sent")}>Done</button>
      <button className="btn-ghost px-3 py-1 text-xs" onClick={() => act("no_show", "No-show — call to rebook")}>No-show</button>
      <button className="btn-ghost px-3 py-1 text-xs" onClick={() => { if (confirm("Cancel it? They get an email with a link to rebook.")) act("cancelled", "Cancelled"); }}>Cancel</button>
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
      </div>
      <details>
        <summary className="cursor-pointer text-xs text-ink-soft">More options</summary>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-1">Every <input className="input w-16" inputMode="numeric" value={f.slot_minutes} onChange={num("slot_minutes", 240)} /> min</label>
          <label className="flex items-center gap-1" title="How many walkthroughs can happen at the same time">At once <input className="input w-14" inputMode="numeric" value={f.per_slot} onChange={num("per_slot", 20)} /></label>
          <label className="flex items-center gap-1">Notice <input className="input w-14" inputMode="numeric" value={f.lead_hours} onChange={num("lead_hours", 168)} /> hours</label>
          <label className="flex items-center gap-1">Up to <input className="input w-14" inputMode="numeric" value={f.horizon_days} onChange={num("horizon_days", 60)} /> days out</label>
          <label className="flex items-center gap-1">Time zone <select className="input w-auto" value={f.time_zone} onChange={(e) => setF({ ...f, time_zone: e.target.value })}>{["America/Detroit", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles"].map((z) => <option key={z}>{z}</option>)}</select></label>
        </div>
      </details>
      <input className="input" placeholder="Email new bookings to (comma-separated; default: OPS_EMAIL)" value={f.notify_emails ?? ""} onChange={(e) => setF({ ...f, notify_emails: e.target.value })} />
      <div className="flex items-center gap-2">
        <button className="btn-primary" onClick={async () => { const e = await post({ action: "settings", ...f, notify_emails: f.notify_emails || null }); setMsg(e ?? "Saved"); router.refresh(); }}>Save</button>
        {msg && <span className="text-ink-soft">{msg}</span>}
      </div>
    </div>
  );
}
