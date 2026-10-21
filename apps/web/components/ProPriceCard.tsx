/*
 * FILE    : apps/web/components/ProPriceCard.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0200 UTC
 * PURPOSE : Pro portal → My prices: one row per service — "Handled's price" or the pro's own % (80–175), an optional
 *           minimum job, on/off, the live example (customer pays / you earn on a typical job) and the local market.
 */
"use client";

import { useState } from "react";
import { PRO_RATE_BAND, money, proPrice, splitJob, typicalPrice } from "@handled/core";

export interface PriceRow { slug: string; name: string; pct: number | null; min_job: number | null; active: boolean; market: { count: number; median: number | null; low: number | null; high: number | null } }

export function ProPriceCard({ rows, es }: { rows: PriceRow[]; es: boolean }) {
  const [items, setItems] = useState(rows);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (slug: string, patch: Partial<PriceRow>) => setItems((xs) => xs.map((x) => (x.slug === slug ? { ...x, ...patch } : x)));
  if (!rows.length) return <p className="text-sm text-ink-soft">{es ? "Agregue sus oficios en Configuración para fijar precios." : "Add your trades in Setup to set prices."}</p>;
  return (
    <div className="space-y-3">
      {items.map((r) => {
        const typical = typicalPrice(r.slug);
        const base = typical ? { price: typical, payout: splitJob(typical, r.slug).payout } : null;
        const mine = typical && r.pct != null ? proPrice(typical, r.pct, r.slug, r.min_job) : null;
        return (
          <div key={r.slug} className="card space-y-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold">{r.name}</div>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={r.pct == null} onChange={(e) => set(r.slug, { pct: e.target.checked ? null : 100, active: !e.target.checked })} />
                {es ? "Usar el precio de Handled" : "Use Handled's price"}
              </label>
            </div>
            {r.pct != null && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="label">{es ? "Mi precio (% del precio de Handled)" : "My price (% of Handled's price)"}: <b>{r.pct}%</b></label>
                  <input type="range" className="w-full" min={PRO_RATE_BAND.min} max={PRO_RATE_BAND.max} step={5} value={r.pct} onChange={(e) => set(r.slug, { pct: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="label">{es ? "Trabajo mínimo (opcional)" : "Minimum job (optional)"}</label>
                  <div className="flex items-center gap-1"><span className="text-ink-soft">$</span><input className="input" inputMode="numeric" value={r.min_job ?? ""} onChange={(e) => set(r.slug, { min_job: Number(e.target.value.replace(/\D/g, "")) || null })} /></div>
                </div>
                <label className="flex items-center gap-2 self-end pb-2 text-xs"><input type="checkbox" checked={r.active} onChange={(e) => set(r.slug, { active: e.target.checked })} /> {es ? "Mostrar a clientes" : "Show to customers"}</label>
              </div>
            )}
            <p className="text-xs text-ink-soft">
              {base && (mine
                ? (es ? `Trabajo típico: el cliente paga ${money(mine.price)} (Handled: ${money(base.price)}) · usted gana ${money(mine.payout)} (Handled: ${money(base.payout)}).` : `Typical job: customer pays ${money(mine.price)} (Handled: ${money(base.price)}) · you earn ${money(mine.payout)} (Handled: ${money(base.payout)}).`)
                : (es ? `Trabajo típico: el cliente paga ${money(base.price)} · usted gana ${money(base.payout)}.` : `Typical job: customer pays ${money(base.price)} · you earn ${money(base.payout)}.`))}
              {r.market.median != null ? (es ? ` Mercado local: la mitad de los profesionales cobra ${r.market.low}%–${r.market.high}% (mediana ${r.market.median}%).` : ` Local market: the middle half of pros charge ${r.market.low}%–${r.market.high}% (median ${r.market.median}%).`) : ""}
            </p>
          </div>
        );
      })}
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={busy} onClick={async () => {
          setBusy(true); setMsg("");
          const r = await fetch("/api/pro/prices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: items.map((i) => ({ slug: i.slug, pct: i.pct, min_job: i.min_job, active: i.active })) }) });
          const j = await r.json().catch(() => ({}));
          setBusy(false); setMsg(r.ok ? (es ? "Guardado." : "Saved.") : String(j.error ?? "Failed"));
        }}>{es ? "Guardar precios" : "Save prices"}</button>
        {msg && <span className="text-sm text-ink-soft">{msg}</span>}
      </div>
    </div>
  );
}
