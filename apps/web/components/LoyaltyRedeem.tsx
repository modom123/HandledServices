/*
 * FILE    : apps/web/components/LoyaltyRedeem.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-07_0530 UTC
 * PURPOSE : "Turn points into credit" for Handled Points (a person's or a business account's points).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoyaltyRedeem({ redeemable, step, perStep, businessId = null, es = false }: { redeemable: number; step: number; perStep: number; businessId?: string | null; es?: boolean }) {
  const router = useRouter();
  const [points, setPoints] = useState(redeemable);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (redeemable < step) return null;
  const options = Array.from({ length: Math.min(20, redeemable / step) }, (_, i) => (i + 1) * step);
  const dollars = (p: number) => `$${((p / step) * perStep).toFixed(2).replace(/\.00$/, "")}`;
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-auto" value={points} onChange={(e) => setPoints(Number(e.target.value))} aria-label={es ? "Puntos a canjear" : "Points to redeem"}>
          {options.map((p) => <option key={p} value={p}>{p.toLocaleString("en-US")} → {dollars(p)}</option>)}
        </select>
        <button className="btn-primary" disabled={busy} onClick={async () => {
          setBusy(true); setMsg(null);
          const res = await fetch("/api/account/loyalty", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ points, business_id: businessId }) });
          const d = await res.json().catch(() => ({}));
          setBusy(false);
          if (d.ok) { setMsg({ ok: true, text: es ? `Listo: código ${d.code} (también por correo). Úselo al pagar.` : `Done: code ${d.code} (also emailed). Use it at checkout.` }); router.refresh(); }
          else setMsg({ ok: false, text: d.error ?? (es ? "Intente de nuevo" : "Try again") });
        }}>{busy ? (es ? "Un momento…" : "One moment…") : es ? "Convertir en crédito" : "Turn into credit"}</button>
      </div>
      {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-brand" : "text-rose-700"}`}>{msg.text}</p>}
    </div>
  );
}
