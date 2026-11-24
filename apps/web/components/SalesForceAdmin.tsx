/*
 * FILE    : apps/web/components/SalesForceAdmin.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-18_0105 UTC
 * PURPOSE : Hub → Sales Force controls: rank (approve VP or correct a rank), whose team, add a partner, run the promotion check.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RANK_ORDER, SALES_RANKS, type SalesRank } from "@handled/core";

async function post(body: Record<string, unknown>) {
  const r = await fetch("/api/hub/sales-force", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return r.ok && j.ok !== false ? null : String(j.error ?? "Failed");
}

export function RepControls({ id, rank, leaderId, leaders }: { id: string; rank: SalesRank; leaderId: string | null; leaders: [string, string][] }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <select className="input w-auto text-xs" defaultValue={rank} onChange={async (e) => {
        const to = e.target.value;
        if (!confirm(`Set ${SALES_RANKS[to as SalesRank].title}? Moving up pays its promotion bonus once.`)) { e.target.value = rank; return; }
        setMsg((await post({ action: "rank", partner_id: id, rank: to })) ?? "Saved"); router.refresh();
      }}>{RANK_ORDER.map((r) => <option key={r} value={r}>{SALES_RANKS[r].short}</option>)}</select>
      <select className="input w-auto text-xs" defaultValue={leaderId ?? ""} onChange={async (e) => { setMsg((await post({ action: "leader", partner_id: id, leader_id: e.target.value || null })) ?? "Saved"); router.refresh(); }}>
        <option value="">No team</option>{leaders.filter(([lid]) => lid !== id).map(([lid, name]) => <option key={lid} value={lid}>{name}&apos;s team</option>)}
      </select>
      {msg && <span className="text-ink-soft">{msg}</span>}
    </div>
  );
}

export function JoinSalesForce({ partners }: { partners: [string, string][] }) {
  const router = useRouter();
  const [id, setId] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <select className="input w-auto" value={id} onChange={(e) => setId(e.target.value)}><option value="">Add a partner to the Sales Force…</option>{partners.map(([pid, name]) => <option key={pid} value={pid}>{name}</option>)}</select>
      <button className="btn-ghost" disabled={!id} onClick={async () => { setMsg((await post({ action: "join", partner_id: id })) ?? "Added as Associate AE"); setId(""); router.refresh(); }}>Add</button>
      <button className="btn-ghost" onClick={async () => { setMsg("Checking…"); setMsg((await post({ action: "refresh" })) ?? "Promotion check done"); router.refresh(); }}>Run promotion check now</button>
      {msg && <span className="text-ink-soft">{msg}</span>}
    </div>
  );
}
