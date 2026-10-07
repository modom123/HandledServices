/*
 * FILE    : apps/web/components/LoyaltyHub.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0530 UTC
 * PURPOSE : Hub → Handled Points client pieces: settings form (admin), adjust an account's points, run release now.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LoyaltySettings } from "@handled/core";

async function post(body: unknown) {
  const res = await fetch("/api/hub/loyalty", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => ({}));
  return res.ok && d.ok !== false ? null : (d.error ?? "Didn't work");
}

export function LoyaltySettingsForm({ s, canEdit }: { s: LoyaltySettings; canEdit: boolean }) {
  const router = useRouter();
  const [f, setF] = useState(s);
  const [msg, setMsg] = useState("");
  const num = (k: keyof LoyaltySettings, label: string, step = "1") => (
    <label className="flex items-center gap-1">{label}<input className="input w-20" type="number" step={step} disabled={!canEdit} value={Number(f[k])} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} /></label>
  );
  return (
    <div className="space-y-3 text-sm">
      <label className="flex items-center gap-2 font-semibold"><input type="checkbox" disabled={!canEdit} checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} /> Points on (earning and redeeming)</label>
      <div className="flex flex-wrap gap-4">
        {num("earnRate", "Points per $1 paid", "0.5")}{num("pointValue", "$ per point", "0.001")}{num("redeemStep", "Redeem block (points)", "50")}
        {num("pendingDays", "Pending days")}{num("inactivityExpiryMonths", "Expire after (months inactive)")}{num("firstJobBonus", "First-job bonus")}{num("reviewBonus", "Review bonus")}
      </div>
      <p className="text-xs text-ink-soft">Cost = points per $1 × $ per point = <b>{Math.round(f.earnRate * f.pointValue * 1000) / 10}% back</b> on the job price (up to {Math.round(f.earnRate * f.pointValue * 1.5 * 1000) / 10}% at Gold). Credits come out of our share; the pro's pay never changes. Changes apply to points earned from now on.</p>
      {canEdit ? <button className="btn-primary" onClick={async () => { setMsg((await post({ action: "settings", ...f })) ?? "Saved"); router.refresh(); }}>Save</button> : <p className="text-xs text-ink-soft">Only an admin can change these.</p>}
      {msg && <span className="ml-2 text-ink-soft">{msg}</span>}
    </div>
  );
}

export function LoyaltyAdjust({ accounts }: { accounts: { key: string; name: string; businessId?: string | null; profileId?: string | null; email?: string | null }[] }) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [email, setEmail] = useState("");
  const [points, setPoints] = useState(100);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <select className="input w-auto" value={key} onChange={(e) => setKey(e.target.value)}>
        <option value="">Customer by email…</option>
        {accounts.map((a) => <option key={a.key} value={a.key}>{a.businessId ? "🏢 " : ""}{a.name}</option>)}
      </select>
      {!key && <input className="input w-56" placeholder="customer@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />}
      <input className="input w-24" type="number" step="25" value={points} onChange={(e) => setPoints(Number(e.target.value))} />
      <input className="input w-64" placeholder="Reason (the customer sees it)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="btn-primary" onClick={async () => {
        const a = accounts.find((x) => x.key === key);
        const who = a ? { business_id: a.businessId ?? null, profile_id: a.profileId ?? null, email: a.email ?? null } : { email };
        const e = await post({ action: "adjust", ...who, points, note });
        setMsg(e ?? "Done"); if (!e) { setNote(""); router.refresh(); }
      }}>Apply</button>
      {msg && <span className="text-ink-soft">{msg}</span>}
    </div>
  );
}

export function LoyaltyRun() {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  return <span><button className="btn-ghost text-sm" onClick={async () => { setMsg((await post({ action: "run" })) ?? "Done"); router.refresh(); }}>Release due points now</button>{msg && <span className="ml-2 text-sm text-ink-soft">{msg}</span>}</span>;
}
