/*
 * FILE    : apps/web/components/TradeRequirements.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-06_0802 UTC
 * PURPOSE : Become a Pro → "What your trade needs": pick your trade from one dropdown and see its insurance, license,
 *           skills check and specialties (replaces a list of 20+ expanders). Text arrives already translated.
 */
"use client";

import { useState } from "react";

export type TradeReq = { id: string; label: string; does: string; lines: string[] };

export function TradeRequirements({ trades, pick, es }: { trades: TradeReq[]; pick: string; es: boolean }) {
  const [id, setId] = useState(trades[0]?.id ?? "");
  const t = trades.find((x) => x.id === id) ?? trades[0];
  if (!t) return null;
  return (
    <div className="card">
      <label className="block text-sm font-semibold" htmlFor="trade-pick">{pick}</label>
      <select id="trade-pick" className="input mt-2 w-full" value={id} onChange={(e) => setId(e.target.value)}>
        {trades.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
      </select>
      <p className="mt-3 text-sm text-ink-soft">{t.does}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{t.lines.map((l) => <li key={l}>{l}</li>)}</ul>
      <p className="mt-3 text-xs text-ink-soft">{es ? "¿No tiene todo todavía? Postúlese de todos modos; le diremos exactamente qué necesita." : "Missing something? Apply anyway — we’ll tell you exactly what you need and point you to brokers."}</p>
    </div>
  );
}
