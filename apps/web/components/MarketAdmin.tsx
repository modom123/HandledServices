/*
 * FILE    : apps/web/components/MarketAdmin.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0152 UTC
 * PURPOSE : Hub → Market pricing controls: override a service's factor (or hand it back to
 *           learning), and re-learn from offers now.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function post(body: unknown) {
  const r = await fetch("/api/hub/market", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return r.ok ? null : j.error ?? "Failed";
}

export function FactorOverride({ slug, manual }: { slug: string; manual: number | null }) {
  const router = useRouter();
  const [v, setV] = useState(manual != null ? String(manual) : "");
  const [msg, setMsg] = useState("");
  return (
    <span className="inline-flex items-center gap-1">
      <input className="input w-20 px-2 py-1 text-xs" placeholder="auto" value={v} onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ""))} />
      <button className="btn-ghost px-2 py-1 text-xs" onClick={async () => { const e = await post({ service_slug: slug, manual_factor: v ? Number(v) : null }); if (e) setMsg(e); else { setMsg(""); router.refresh(); } }}>Set</button>
      {msg && <span className="text-xs text-rose-700">{msg}</span>}
    </span>
  );
}

export function RelearnButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return <button className="btn-ghost text-sm" disabled={busy} onClick={async () => { setBusy(true); await post({ action: "relearn" }); setBusy(false); router.refresh(); }}>{busy ? "Learning…" : "Re-learn from offers now"}</button>;
}
