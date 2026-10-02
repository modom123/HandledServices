/*
 * FILE    : apps/web/components/GiftCardForm.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : Gift card purchase form → /api/gift-cards → Stripe Checkout.
 */
"use client";

import { useState } from "react";

const AMOUNTS = [50, 100, 150, 250];

export function GiftCardForm() {
  const [amount, setAmount] = useState(100);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <form className="card space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true); setErr("");
      const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
      const res = await fetch("/api/gift-cards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, amount }) });
      const d = await res.json().catch(() => ({}));
      setBusy(false);
      if (d.url) window.location.href = d.url; else setErr(d.error ?? "Try again");
    }}>
      <div>
        <label className="label">Amount</label>
        <div className="flex flex-wrap gap-2">
          {AMOUNTS.map((a) => <button key={a} type="button" onClick={() => setAmount(a)} className={`rounded-full border px-4 py-1.5 text-sm ${amount === a ? "border-brand bg-brand-tint font-semibold text-brand-dark" : "border-line bg-white"}`}>${a}</button>)}
          <input className="input w-28" type="number" min={25} max={1000} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label">Recipient name</label><input name="recipient_name" className="input" /></div>
        <div><label className="label">Recipient email</label><input name="recipient_email" type="email" required className="input" /></div>
        <div><label className="label">Your name</label><input name="purchaser_name" className="input" /></div>
        <div><label className="label">Your email</label><input name="purchaser_email" type="email" required className="input" /></div>
      </div>
      <div><label className="label">Message (optional)</label><textarea name="message" maxLength={300} className="input min-h-20" placeholder="Happy birthday — enjoy a day off!" /></div>
      {err && <p className="text-sm text-rose-700">{err}</p>}
      <button className="btn-primary w-full" disabled={busy || !(amount >= 25 && amount <= 1000)}>{busy ? "One moment…" : `Buy $${amount} gift card`}</button>
    </form>
  );
}
