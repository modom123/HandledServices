/*
 * FILE    : apps/web/components/CallHoursEditor.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_1530 UTC
 * PURPOSE : Hub → Lead inbox → Scheduled calls → Call hours (admins): which days and hours customers can book a call,
 *           slot length, how many people take calls at once, minimum notice and how far ahead. Saved to site_settings
 *           "call_hours" via /api/hub/site; the booking calendar on the website uses it right away.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CALL_SLOT_CHOICES, type CallHours } from "@handled/core";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ZONES = [["America/Detroit", "Eastern"], ["America/Chicago", "Central"], ["America/Denver", "Mountain"], ["America/Los_Angeles", "Pacific"]];

export function CallHoursEditor({ initial }: { initial: CallHours }) {
  const router = useRouter();
  const [h, setH] = useState<CallHours>(initial);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const setDay = (i: number, v: readonly [string, string] | null) => setH({ ...h, days: h.days.map((d, j) => (j === i ? v : d)) });
  const num = (k: "callers" | "minNoticeMinutes" | "horizonDays") => (e: React.ChangeEvent<HTMLInputElement>) => setH({ ...h, [k]: Number(e.target.value) });

  if (!open) return <button type="button" className="mt-3 text-sm font-semibold text-brand" onClick={() => setOpen(true)}>⚙️ Call hours</button>;
  return (
    <div className="mt-4 space-y-3 rounded-xl border border-line bg-paper p-4 text-sm">
      <div className="font-semibold">Call hours — when customers can book a call</div>
      <div className="grid gap-2">
        {DAYS.map((name, i) => {
          const d = h.days[i];
          return (
            <div key={name} className="flex flex-wrap items-center gap-2">
              <label className="flex w-32 items-center gap-2"><input type="checkbox" checked={Boolean(d)} onChange={(e) => setDay(i, e.target.checked ? ["09:00", "17:00"] : null)} />{name}</label>
              {d ? (
                <>
                  <input type="time" step={900} className="input w-32" value={d[0]} onChange={(e) => setDay(i, [e.target.value, d[1]])} aria-label={`${name} opens`} />
                  <span>to</span>
                  <input type="time" step={900} className="input w-32" value={d[1]} onChange={(e) => setDay(i, [d[0], e.target.value])} aria-label={`${name} closes`} />
                </>
              ) : <span className="text-ink-soft">No calls</span>}
            </div>
          );
        })}
      </div>
      <div className="grid gap-3 sm:grid-cols-5">
        <label className="text-xs font-semibold text-ink-soft">Time zone
          <select className="input mt-1" value={h.tz} onChange={(e) => setH({ ...h, tz: e.target.value })}>{ZONES.map(([z, l]) => <option key={z} value={z}>{l}</option>)}</select>
        </label>
        <label className="text-xs font-semibold text-ink-soft">Call length
          <select className="input mt-1" value={h.slotMinutes} onChange={(e) => setH({ ...h, slotMinutes: Number(e.target.value) })}>{CALL_SLOT_CHOICES.map((m) => <option key={m} value={m}>{m} min</option>)}</select>
        </label>
        <label className="text-xs font-semibold text-ink-soft">People taking calls<input type="number" min={1} max={20} className="input mt-1" value={h.callers} onChange={num("callers")} /></label>
        <label className="text-xs font-semibold text-ink-soft">Notice (minutes)<input type="number" min={0} max={2880} step={15} className="input mt-1" value={h.minNoticeMinutes} onChange={num("minNoticeMinutes")} /></label>
        <label className="text-xs font-semibold text-ink-soft">Days ahead<input type="number" min={1} max={60} className="input mt-1" value={h.horizonDays} onChange={num("horizonDays")} /></label>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary" disabled={busy} onClick={async () => {
          setBusy(true); setMsg("");
          const r = await fetch("/api/hub/site", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "call_hours", hours: h }) });
          const j = await r.json().catch(() => ({}));
          setBusy(false);
          setMsg(r.ok ? "Saved — the website calendar uses these hours now." : String(j.error ?? "Couldn't save"));
          if (r.ok) router.refresh();
        }}>{busy ? "Saving…" : "Save call hours"}</button>
        <button type="button" className="text-ink-soft" onClick={() => { setH(initial); setOpen(false); }}>Cancel</button>
        {msg && <span className="text-xs">{msg}</span>}
      </div>
    </div>
  );
}
