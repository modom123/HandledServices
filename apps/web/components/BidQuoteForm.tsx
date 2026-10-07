/*
 * FILE    : apps/web/components/BidQuoteForm.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_1954 UTC
 * PURPOSE : The pro's written quote for a public bid (from /pros/bid-quote/[token]): a price per line, capacity,
 *           small-business status and a note — or "not for us". Can be updated until the bid is submitted.
 */
"use client";

import { useState } from "react";

type L = { id: string; item: string; unit: string; qty: number; years: number };

export function BidQuoteForm({ token, lines, initial }: { token: string; lines: L[]; initial: { status: string; prices: Record<string, number>; capacity: string | null; small_business: boolean | null; note: string | null } }) {
  const [prices, setPrices] = useState<Record<string, string>>(Object.fromEntries(Object.entries(initial.prices ?? {}).map(([k, v]) => [k, String(v)])));
  const [capacity, setCapacity] = useState(initial.capacity ?? "");
  const [small, setSmall] = useState<boolean | null>(initial.small_business);
  const [note, setNote] = useState(initial.note ?? "");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(initial.status === "committed" ? "Your prices are in. You can update them below until the bid is submitted." : initial.status === "declined" ? "You said this one isn't for you. You can still send prices below." : "");
  const [err, setErr] = useState("");
  async function send(decline: boolean) {
    setBusy(true); setErr("");
    const nums = Object.fromEntries(Object.entries(prices).map(([k, v]) => [k, Number(v)]).filter(([, v]) => Number(v) > 0));
    const r = await fetch(`/api/bid-quote/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decline, prices: decline ? {} : nums, capacity: capacity || null, small_business: small, note: note || null, agree }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok && j.ok) setDone(decline ? "Thanks for letting us know." : "Thank you — your prices are in. You can update them here until the bid is submitted.");
    else setErr(String(j.error ?? "Something went wrong"));
  }
  return (
    <div className="space-y-4">
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Work</th><th className="p-3">Unit</th><th className="p-3">About how many a year</th><th className="p-3">Your price per unit</th></tr></thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-t border-line">
                <td className="p-3">{l.item}</td>
                <td className="p-3">{l.unit}</td>
                <td className="p-3">{l.qty ? l.qty.toLocaleString("en-US") : "—"}</td>
                <td className="p-3"><div className="flex items-center gap-1">$<input className="input w-28" inputMode="decimal" value={prices[l.id] ?? ""} onChange={(e) => setPrices({ ...prices, [l.id]: e.target.value.replace(/[^\d.]/g, "") })} placeholder="—" /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card space-y-3 text-sm">
        <div><label className="label">How much can your business cover? (crews, days, areas, any limits)</label><textarea className="input min-h-20" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></div>
        <div>
          <div className="label">Is your business a small business (under the SBA size standard for this work)?</div>
          <div className="flex gap-4">{[[true, "Yes"], [false, "No"], [null, "Not sure"]].map(([v, t]) => <label key={String(t)} className="flex items-center gap-1"><input type="radio" checked={small === v} onChange={() => setSmall(v as boolean | null)} /> {t as string}</label>)}</div>
        </div>
        <div><label className="label">Anything we should know (equipment, insurance, questions)</label><textarea className="input min-h-16" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> <span>These are my business&apos;s prices. They hold for 120 days, and for the first contract year if the bid is won and the work is offered to me. I can still decline the subcontract when it&apos;s offered.</span></label>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={busy || !agree} onClick={() => send(false)}>Send my prices</button>
          <button className="btn-ghost" disabled={busy} onClick={() => send(true)}>Not for us</button>
        </div>
        {done && <p className="text-brand">{done}</p>}
        {err && <p className="text-rose-700">{err}</p>}
      </div>
    </div>
  );
}
