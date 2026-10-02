/*
 * FILE    : apps/web/components/PromoAdmin.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : Hub: create a promo code and switch codes on/off.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewPromo() {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  return (
    <form className="card grid gap-3 sm:grid-cols-6" onSubmit={async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
      const res = await fetch("/api/hub/promos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, first_job_only: f.first_job_only === "on", max_uses: f.max_uses || undefined }) });
      const d = await res.json().catch(() => ({}));
      setMsg(res.ok ? "Created ✓" : d.error ?? "Try again");
      if (res.ok) { (e.target as HTMLFormElement).reset(); router.refresh(); }
    }}>
      <div className="sm:col-span-2"><label className="label">Code</label><input name="code" required className="input uppercase" placeholder="SPRING25" /></div>
      <div><label className="label">Type</label><select name="kind" className="input"><option value="amount">$ off</option><option value="percent">% off</option></select></div>
      <div><label className="label">Value</label><input name="value" type="number" step="1" min="1" required className="input" /></div>
      <div><label className="label">Max uses</label><input name="max_uses" type="number" min="1" className="input" placeholder="∞" /></div>
      <div><label className="label">Expires</label><input name="expires_at" type="date" className="input" /></div>
      <div><label className="label">Min order $</label><input name="min_order" type="number" min="0" defaultValue={0} className="input" /></div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="first_job_only" /> First-time customers only</label>
      <div className="sm:col-span-2"><input name="note" className="input" placeholder="Note (campaign, partner…)" /></div>
      <div className="flex items-center gap-3"><button className="btn-primary">Create code</button>{msg && <span className="text-sm">{msg}</span>}</div>
    </form>
  );
}

export function PromoToggle({ code, active }: { code: string; active: boolean }) {
  const router = useRouter();
  return <button className="text-xs underline" onClick={async () => { await fetch("/api/hub/promos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toggle: code, active: !active }) }); router.refresh(); }}>{active ? "Turn off" : "Turn on"}</button>;
}
