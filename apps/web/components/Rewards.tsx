/*
 * FILE    : apps/web/components/Rewards.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_0418 UTC
 * PURPOSE : Pro Rewards UI: the pro's redeem form (shipping address), and the Hub controls (settings, catalog items,
 *           order status, point adjustments / forfeits, run the release now).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { REDEMPTION_LABEL, REWARD_CATEGORY_LABEL, type RedemptionStatus, type RewardCategory, type RewardSettings } from "@handled/core";

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return r.ok && j.ok !== false ? null : String(j.error ?? "Failed");
}

export function RedeemButton({ itemId, name, points, available, es, address }: { itemId: string; name: string; points: number; available: number; es: boolean; address: { name: string; line1: string; city: string; state: string; zip: string; phone: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [a, setA] = useState({ ...address, line2: "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const short = available < points;
  if (!open) return <button className={short ? "btn-ghost text-xs" : "btn-primary text-xs"} disabled={short} onClick={() => setOpen(true)}>{short ? (es ? `Faltan ${(points - available).toLocaleString("en-US")} pts` : `${(points - available).toLocaleString("en-US")} more pts`) : es ? "Canjear" : "Redeem"}</button>;
  const f = (k: keyof typeof a, label: string, cls = "") => <input className={`input text-xs ${cls}`} placeholder={label} value={a[k]} onChange={(e) => setA({ ...a, [k]: e.target.value })} />;
  return (
    <div className="mt-2 space-y-2 rounded-lg bg-paper p-2">
      <div className="text-xs font-semibold">{es ? `Enviar ${name} a:` : `Ship ${name} to:`}</div>
      {f("name", es ? "Nombre" : "Name")}{f("line1", es ? "Dirección" : "Street address")}{f("line2", es ? "Depto. (opcional)" : "Apt / unit (optional)")}
      <div className="grid grid-cols-3 gap-1">{f("city", es ? "Ciudad" : "City")}{f("state", "MI")}{f("zip", "ZIP")}</div>
      {f("phone", es ? "Teléfono" : "Phone")}
      <p className="text-[11px] text-ink-soft">{es ? "Los premios cuentan como ingreso y aparecen en su 1099 por su valor de mercado." : "Rewards count as income and appear on your 1099 at fair market value."}</p>
      <div className="flex gap-2">
        <button className="btn-primary text-xs" disabled={busy} onClick={async () => { setBusy(true); const e = await post("/api/pro/rewards", { item_id: itemId, ship_to: { ...a, state: a.state.toUpperCase() } }); setBusy(false); if (e) setMsg(e); else { setOpen(false); router.refresh(); } }}>{es ? `Canjear ${points.toLocaleString("en-US")} pts` : `Redeem ${points.toLocaleString("en-US")} pts`}</button>
        <button className="text-xs underline" onClick={() => setOpen(false)}>{es ? "Cancelar" : "Cancel"}</button>
      </div>
      {msg && <p className="text-xs text-rose-700">{msg}</p>}
    </div>
  );
}

// ── Hub ──────────────────────────────────────────────────────────────────────

export function RewardSettingsForm({ s, canEdit }: { s: RewardSettings; canEdit: boolean }) {
  const router = useRouter();
  const [f, setF] = useState(s);
  const [msg, setMsg] = useState("");
  const num = (k: keyof RewardSettings, label: string, step = "1") => (
    <label className="flex items-center gap-1">{label}<input className="input w-20" type="number" step={step} disabled={!canEdit} value={Number(f[k])} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} /></label>
  );
  return (
    <div className="space-y-3 text-sm">
      <label className="flex items-center gap-2 font-semibold"><input type="checkbox" disabled={!canEdit} checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} /> Rewards on (earning and redeeming)</label>
      <div className="flex flex-wrap gap-4">
        {num("earnRate", "Points per $1 of our take", "1")}{num("pointValue", "$ per point", "0.001")}{num("pendingDays", "Pending days")}
        {num("qualityMultiplier", "Quality ×", "0.05")}{num("minRatingForQuality", "Min rating", "0.1")}{num("inactivityExpiryMonths", "Expire after (months inactive)")}
      </div>
      <p className="text-xs text-ink-soft">Base cost = points per $1 × $ per point = <b>{Math.round(f.earnRate * f.pointValue * 1000) / 10}% of our take</b> (up to {Math.round(f.earnRate * f.pointValue * f.qualityMultiplier * 1.5 * 1000) / 10}% for long-tenured, high-quality pros). Changes apply to points earned from now on; points already earned are never taken back.</p>
      {canEdit ? <button className="btn-primary" onClick={async () => { const e = await post("/api/hub/rewards", { action: "settings", ...f }); setMsg(e ?? "Saved"); router.refresh(); }}>Save</button> : <p className="text-xs text-ink-soft">Only an admin can change these.</p>}
      {msg && <span className="ml-2 text-ink-soft">{msg}</span>}
    </div>
  );
}

type Item = { id?: string; name: string; name_es: string | null; category: RewardCategory; points: number; cost_usd: number; description: string | null; description_es: string | null; image_url: string | null; stock: number | null; active: boolean; sort?: number };

export function CatalogItemForm({ item }: { item?: Item }) {
  const router = useRouter();
  const [f, setF] = useState<Item>(item ?? { name: "", name_es: "", category: "merch", points: 5000, cost_usd: 50, description: "", description_es: "", image_url: "", stock: null, active: true });
  const [open, setOpen] = useState(!item);
  const [msg, setMsg] = useState("");
  if (!open) return <button className="text-xs underline" onClick={() => setOpen(true)}>Edit</button>;
  const t = (k: keyof Item, label: string) => <input className="input text-xs" placeholder={label} value={String(f[k] ?? "")} onChange={(e) => setF({ ...f, [k]: e.target.value })} />;
  return (
    <div className="grid gap-2 rounded-lg bg-paper p-2 text-xs sm:grid-cols-3">
      {t("name", "Name")}{t("name_es", "Nombre (ES)")}
      <select className="input text-xs" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as RewardCategory })}>{(Object.keys(REWARD_CATEGORY_LABEL) as RewardCategory[]).map((c) => <option key={c} value={c}>{REWARD_CATEGORY_LABEL[c].en}</option>)}</select>
      <label className="flex items-center gap-1">Points<input className="input text-xs" type="number" value={f.points} onChange={(e) => setF({ ...f, points: Number(e.target.value) })} /></label>
      <label className="flex items-center gap-1">Our cost / FMV $<input className="input text-xs" type="number" value={f.cost_usd} onChange={(e) => setF({ ...f, cost_usd: Number(e.target.value) })} /></label>
      <label className="flex items-center gap-1">Stock<input className="input text-xs" type="number" placeholder="unlimited" value={f.stock ?? ""} onChange={(e) => setF({ ...f, stock: e.target.value === "" ? null : Number(e.target.value) })} /></label>
      {t("description", "Description")}{t("description_es", "Descripción (ES)")}{t("image_url", "Image URL (optional)")}
      <label className="flex items-center gap-1"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Active</label>
      <div className="flex items-center gap-2 sm:col-span-2">
        <button className="btn-primary text-xs" onClick={async () => { const e = await post("/api/hub/rewards", { action: "item", ...f, name_es: f.name_es || null, description: f.description || null, description_es: f.description_es || null, image_url: f.image_url || null }); setMsg(e ?? "Saved"); if (!e) { if (item) setOpen(false); router.refresh(); } }}>{item ? "Save" : "Add reward"}</button>
        <span className="text-ink-soft">{f.cost_usd > 0 ? `${Math.round((f.cost_usd / (f.points / 100)) * 100)}% of the point value` : ""}</span>
        {msg && <span>{msg}</span>}
      </div>
    </div>
  );
}

export function OrderActions({ id, status }: { id: string; status: RedemptionStatus }) {
  const router = useRouter();
  const [tracking, setTracking] = useState("");
  const [msg, setMsg] = useState("");
  const next: RedemptionStatus[] = status === "requested" ? ["approved", "cancelled"] : status === "approved" ? ["ordered", "cancelled"] : status === "ordered" ? ["shipped", "delivered", "cancelled"] : status === "shipped" ? ["delivered"] : [];
  if (!next.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      {status === "ordered" && <input className="input w-36 text-xs" placeholder="Tracking #" value={tracking} onChange={(e) => setTracking(e.target.value)} />}
      {next.map((s) => <button key={s} className={s === "cancelled" ? "btn-ghost text-xs text-rose-700" : "btn-ghost text-xs"} onClick={async () => { if (s === "cancelled" && !confirm("Cancel and return the points?")) return; const e = await post("/api/hub/rewards", { action: "order", id, status: s, tracking: tracking || null }); setMsg(e ?? ""); router.refresh(); }}>{REDEMPTION_LABEL[s].en.replace(" — points returned", "")}</button>)}
      {msg && <span className="text-rose-700">{msg}</span>}
    </div>
  );
}

export function PointsAdjust({ contractors }: { contractors: { id: string; name: string }[] }) {
  const router = useRouter();
  const [f, setF] = useState({ contractor_id: "", points: "", note: "" });
  const [msg, setMsg] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <select className="input w-56" value={f.contractor_id} onChange={(e) => setF({ ...f, contractor_id: e.target.value })}><option value="">Pro…</option>{contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <input className="input w-28" placeholder="± points" value={f.points} onChange={(e) => setF({ ...f, points: e.target.value.replace(/[^\d-]/g, "") })} />
      <input className="input flex-1" placeholder="Reason (shows in their history)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      <button className="btn-ghost" disabled={!f.contractor_id || !Number(f.points) || f.note.length < 3} onClick={async () => { const e = await post("/api/hub/rewards", { action: "adjust", contractor_id: f.contractor_id, points: Number(f.points), note: f.note }); setMsg(e ?? "Done"); router.refresh(); }}>Adjust</button>
      <button className="btn-ghost text-rose-700" disabled={!f.contractor_id || f.note.length < 3} onClick={async () => { if (!confirm("Forfeit all of this pro's points (deactivated for cause)?")) return; const e = await post("/api/hub/rewards", { action: "forfeit", contractor_id: f.contractor_id, note: f.note }); setMsg(e ?? "Forfeited"); router.refresh(); }}>Forfeit all</button>
      <button className="btn-ghost" onClick={async () => { const e = await post("/api/hub/rewards", { action: "run" }); setMsg(e ?? "Released pending points and milestones"); router.refresh(); }}>Run release now</button>
      {msg && <span className="text-ink-soft">{msg}</span>}
    </div>
  );
}
