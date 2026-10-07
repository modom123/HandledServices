/*
 * FILE    : apps/web/components/SiteSettingsUI.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-07_0250 UTC
 * PURPOSE : Hub → Website & promotions controls: pick the default website look; set up the grand opening promotion.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function post(body: unknown) {
  const r = await fetch("/api/hub/site", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return r.ok ? null : String(j.error ?? "Failed");
}

export function ThemePicker({ themes, current, admin }: { themes: { id: string; name: string; note: string }[]; current: string; admin: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <div className="grid gap-3 md:grid-cols-3">{themes.map((t) => (
        <div key={t.id} className={`rounded-xl border p-4 ${t.id === current ? "border-brand bg-brand-tint" : "border-line"}`}>
          <div className="font-semibold">{t.name}{t.id === current && <span className="ml-2 text-xs font-normal text-brand">default</span>}</div>
          <p className="mt-1 text-xs text-ink-soft">{t.note}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a className="btn-ghost px-3 py-1 text-xs" href={`/home?theme=${t.id}`} target="_blank" rel="noreferrer">Preview</a>
            {admin && t.id !== current && <button className="btn-primary px-3 py-1 text-xs" onClick={async () => { const e = await post({ action: "theme", theme: t.id }); setMsg(e ?? `Default look is now ${t.name}.`); router.refresh(); }}>Make default</button>}
          </div>
        </div>
      ))}</div>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}

export type PromoForm = { enabled: boolean; start: string; days: number; pct: number; fullDiscount: boolean };

export function PromoEditor({ value, admin }: { value: PromoForm; admin: boolean }) {
  const router = useRouter();
  const [f, setF] = useState({ ...value, pctText: String(Math.round(value.pct * 100)) });
  const [msg, setMsg] = useState<string | null>(null);
  if (!admin) return <p className="text-sm text-ink-soft">Admins can change the promotion.</p>;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />Promotion on</label>
        <label>Starts<input className="input mt-1" type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></label>
        <label>Days<input className="input mt-1 w-24" type="number" min={1} max={365} value={f.days} onChange={(e) => setF({ ...f, days: Number(e.target.value) })} /></label>
        <label>Discount %<input className="input mt-1 w-24" type="number" min={1} max={50} value={f.pctText} onChange={(e) => setF({ ...f, pctText: e.target.value })} /></label>
      </div>
      <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={f.fullDiscount} onChange={(e) => setF({ ...f, fullDiscount: e.target.checked })} />
        <span>Give the full discount on every service, even where it&apos;s more than our share (we cover the difference; pros are always paid in full). Off = &quot;up to&quot;: the discount stops where we&apos;d keep less than 5% of the price.</span></label>
      <button className="btn-primary" onClick={async () => {
        const e = await post({ action: "promo", enabled: f.enabled, start: f.start, days: f.days, pct: Number(f.pctText) / 100, fullDiscount: f.fullDiscount });
        setMsg(e ?? "Saved."); router.refresh();
      }}>Save promotion</button>
      {msg && <p>{msg}</p>}
    </div>
  );
}
