/*
 * FILE    : apps/web/components/MarketsAdmin.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_1513 UTC
 * PURPOSE : Hub → City scorecard controls: add a city (name, state, ZIP prefixes) and pause / resume one.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function post(body: unknown) {
  const r = await fetch("/api/hub/markets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return r.ok ? null : String(j.error ?? "Failed");
}

export function MarketForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [state, setState] = useState("MI");
  const [zips, setZips] = useState("");
  const [msg, setMsg] = useState("");
  const prefixes = zips.split(/[\s,]+/).map((z) => z.trim().slice(0, 3)).filter((z) => /^\d{3}$/.test(z));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input className="input max-w-xs" placeholder="City / metro (e.g. Grand Rapids)" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="input w-20" maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} aria-label="State" />
      <input className="input max-w-xs" placeholder="ZIP prefixes, e.g. 493, 494, 495" value={zips} onChange={(e) => setZips(e.target.value)} />
      <button className="btn-primary" disabled={name.trim().length < 2 || state.length !== 2 || !prefixes.length} onClick={async () => { setMsg(""); const e = await post({ name, state, zip_prefixes: prefixes }); if (e) setMsg(e); else { setName(""); setZips(""); router.refresh(); } }}>Add city</button>
      {msg && <span className="text-sm text-rose-700">{msg}</span>}
    </div>
  );
}

export function MarketToggle({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return <button className="text-xs text-ink-soft underline" disabled={busy} onClick={async () => { setBusy(true); await post({ id, active: !active }); setBusy(false); router.refresh(); }}>{active ? "Pause city" : "Resume city"}</button>;
}
