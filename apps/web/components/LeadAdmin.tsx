/*
 * FILE    : apps/web/components/LeadAdmin.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0210 UTC
 * PURPOSE : Hub → Pro leads controls: engine settings, run now, CSV import, and call-list actions.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TRADES } from "@handled/core";

async function post(body: unknown) {
  const r = await fetch("/api/hub/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, data: j };
}

export interface LeadSettingsForm { enabled: boolean; discover_per_day: number; emails_per_day: number; min_rating: number; min_reviews: number; trades: string[] }

export function LeadSettingsPanel({ initial }: { initial: LeadSettingsForm }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [msg, setMsg] = useState("");
  const num = (k: keyof LeadSettingsForm, label: string, step = 1) => (
    <label className="text-xs"><span className="label">{label}</span><input className="input" type="number" step={step} value={String(s[k])} onChange={(e) => setS({ ...s, [k]: Number(e.target.value) })} /></label>
  );
  return (
    <div className="card space-y-3">
      <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} /> Lead engine on (weekdays 10:30am)</label>
      <div className="grid gap-3 sm:grid-cols-4">{num("discover_per_day", "Searches / day")}{num("emails_per_day", "Emails / day")}{num("min_rating", "Min. Google rating", 0.1)}{num("min_reviews", "Min. reviews")}</div>
      <div>
        <div className="label">Trades to recruit (none checked = wherever Supply gaps shows a shortage, plus all trades across the metro)</div>
        <div className="flex flex-wrap gap-1.5">{TRADES.map((t) => {
          const on = s.trades.includes(t.id);
          return <button type="button" key={t.id} className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-brand bg-brand-tint font-semibold" : "border-line"}`} onClick={() => setS({ ...s, trades: on ? s.trades.filter((x) => x !== t.id) : [...s.trades, t.id] })}>{t.label}</button>;
        })}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" onClick={async () => { const r = await post({ action: "settings", ...s }); setMsg(r.ok ? "Saved" : r.data.error ?? "Failed"); router.refresh(); }}>Save settings</button>
        <button className="btn-ghost" onClick={async () => { setMsg("Running…"); const r = await post({ action: "run" }); setMsg(r.ok ? `Done: ${JSON.stringify(r.data)}` : r.data.error ?? "Failed"); router.refresh(); }}>Run now</button>
        {msg && <span className="text-sm text-ink-soft">{msg}</span>}
      </div>
      <p className="text-xs text-ink-soft">Start small (10–40 emails a day) so the outreach domain builds a good reputation, then raise it.</p>
    </div>
  );
}

export function LeadImport() {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [trade, setTrade] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <div className="card space-y-2 text-sm">
      <div className="font-semibold">Import a list (CSV)</div>
      <p className="text-xs text-ink-soft">Columns (any order, header row): business_name, contact_name, email, phone, city, zip, trade, license_number, website. Good sources: Michigan LARA license lists (plumbers, electricians, residential builders), trade-school graduate lists, supply-house contractor lists. Leads with an email get the invitation; phone-only go to the call list.</p>
      <div className="flex flex-wrap gap-2">
        <input type="file" accept=".csv,text/csv" className="text-xs" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsv(await f.text()); }} />
        <select className="input w-auto" value={trade} onChange={(e) => setTrade(e.target.value)}><option value="">Trade from the file’s “trade” column</option>{TRADES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
        <button className="btn-ghost" disabled={csv.length < 10} onClick={async () => { const r = await post({ action: "import", csv, trade: trade || null }); setMsg(r.ok ? `Added ${r.data.added}, skipped ${r.data.skipped}` : r.data.error ?? "Failed"); router.refresh(); }}>Import</button>
        {msg && <span className="text-ink-soft">{msg}</span>}
      </div>
    </div>
  );
}

export function LeadActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const set = async (s: string) => { await post({ action: "status", id, status: s, note: null }); router.refresh(); };
  return (
    <span className="inline-flex flex-wrap gap-1">
      {status === "call" && <button className="text-xs text-brand underline" onClick={() => set("replied")}>Interested</button>}
      <button className="text-xs text-ink-soft underline" onClick={() => set("not_interested")}>Not interested</button>
      <button className="text-xs text-rose-700 underline" onClick={() => set("do_not_contact")}>Do not contact</button>
    </span>
  );
}
