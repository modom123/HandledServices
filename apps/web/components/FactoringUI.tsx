/*
 * FILE    : apps/web/components/FactoringUI.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-06_0324 UTC
 * PURPOSE : Hub → Factoring controls: update a partner's outreach status and quote; add another factoring company.
 *           Rates are typed as percents here and saved as fractions.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FACTORING_STATUS_LABEL, type FactoringStatus } from "@handled/core";

export type FactoringRow = {
  id: string; name: string; status: FactoringStatus; gov_scope: string | null; advance_rate: number | null; fee_pct: number | null;
  fee_period_days: number | null; days_to_fund: number | null; recourse: "recourse" | "non_recourse" | null; monthly_minimum: number | null;
  term: string | null; spot_factoring: boolean | null; other_fees: string | null; contact_name: string | null; contact_email: string | null;
  contact_phone: string | null; contacted_at: string | null; notes: string | null;
};

async function post(body: unknown) {
  const r = await fetch("/api/hub/factoring", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return r.ok ? null : String(j.error ?? "Failed");
}

const pct = (v: number | null) => (v == null ? "" : String(+(v * 100).toFixed(3)));
const fromPct = (s: string) => (s.trim() === "" ? null : Number(s) / 100);
const n = (s: string) => (s.trim() === "" ? null : Number(s));
const t = (s: string) => (s.trim() === "" ? null : s.trim());

/** One partner's status and quote. */
export function FactoringEditor({ row }: { row: FactoringRow }) {
  const router = useRouter();
  const [f, setF] = useState({
    status: row.status, gov_scope: row.gov_scope ?? "", advance_rate: pct(row.advance_rate), fee_pct: pct(row.fee_pct),
    fee_period_days: row.fee_period_days?.toString() ?? "", days_to_fund: row.days_to_fund?.toString() ?? "", recourse: row.recourse ?? "",
    monthly_minimum: row.monthly_minimum?.toString() ?? "", term: row.term ?? "", spot_factoring: row.spot_factoring == null ? "" : row.spot_factoring ? "yes" : "no",
    other_fees: row.other_fees ?? "", contact_name: row.contact_name ?? "", contact_email: row.contact_email ?? "", contact_phone: row.contact_phone ?? "",
    contacted_at: row.contacted_at ?? "", notes: row.notes ?? "",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  type K = keyof typeof f;
  const field = (k: K, label: string, type = "text") => (
    <label className="text-xs text-ink-soft">{label}<input className="input mt-1" type={type} step="any" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
  );
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-semibold text-brand">Update status &amp; quote</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <label className="text-xs text-ink-soft">Status<select className="input mt-1" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as FactoringStatus })}>{(Object.keys(FACTORING_STATUS_LABEL) as FactoringStatus[]).map((k) => <option key={k} value={k}>{FACTORING_STATUS_LABEL[k]}</option>)}</select></label>
        {field("advance_rate", "Advance rate (%)", "number")}
        {field("fee_pct", "Fee (%) per period", "number")}
        {field("fee_period_days", "Fee period (days, usually 30)", "number")}
        {field("days_to_fund", "Days to fund", "number")}
        <label className="text-xs text-ink-soft">Recourse<select className="input mt-1" value={f.recourse} onChange={(e) => setF({ ...f, recourse: e.target.value as typeof f.recourse })}><option value="">Unknown</option><option value="recourse">Recourse</option><option value="non_recourse">Non-recourse</option></select></label>
        {field("monthly_minimum", "Monthly minimum ($)", "number")}
        <label className="text-xs text-ink-soft">Spot factoring<select className="input mt-1" value={f.spot_factoring} onChange={(e) => setF({ ...f, spot_factoring: e.target.value })}><option value="">Unknown</option><option value="yes">Yes</option><option value="no">No</option></select></label>
        {field("gov_scope", "Funds (federal / state / city)")}
        {field("term", "Term / early-exit fee")}
        {field("other_fees", "Other fees")}
        {field("contacted_at", "Date contacted", "date")}
        {field("contact_name", "Contact name")}
        {field("contact_email", "Contact email", "email")}
        {field("contact_phone", "Contact phone")}
      </div>
      <label className="mt-2 block text-xs text-ink-soft">Notes<textarea className="input mt-1" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
      <div className="mt-2 flex items-center gap-2">
        <button className="btn-primary" disabled={busy} onClick={async () => {
          setBusy(true); setMsg(null);
          const err = await post({
            action: "update", id: row.id, status: f.status, gov_scope: t(f.gov_scope), advance_rate: fromPct(f.advance_rate), fee_pct: fromPct(f.fee_pct),
            fee_period_days: n(f.fee_period_days), days_to_fund: n(f.days_to_fund), recourse: f.recourse || null, monthly_minimum: n(f.monthly_minimum),
            term: t(f.term), spot_factoring: f.spot_factoring === "" ? null : f.spot_factoring === "yes", other_fees: t(f.other_fees),
            contact_name: t(f.contact_name), contact_email: f.contact_email.trim(), contact_phone: t(f.contact_phone), contacted_at: f.contacted_at, notes: t(f.notes),
          });
          setBusy(false);
          if (err) setMsg(err); else { setMsg("Saved."); router.refresh(); }
        }}>Save</button>
        {msg && <span className="text-xs text-ink-soft">{msg}</span>}
      </div>
    </details>
  );
}

/** Another factoring company to compare. */
export function AddFactoringPartner() {
  const router = useRouter();
  const [f, setF] = useState({ name: "", website: "", fit: "" });
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-[1fr_1fr_2fr_auto]">
      <input className="input" placeholder="Company name *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <input className="input" placeholder="Website" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
      <input className="input" placeholder="Why it fits" value={f.fit} onChange={(e) => setF({ ...f, fit: e.target.value })} />
      <button className="btn-dark" disabled={f.name.trim().length < 2} onClick={async () => {
        const err = await post({ action: "add", name: f.name, website: t(f.website), fit: t(f.fit) });
        if (err) setMsg(err); else { setF({ name: "", website: "", fit: "" }); setMsg(null); router.refresh(); }
      }}>Add</button>
      {msg && <span className="text-xs text-rose-600">{msg}</span>}
    </div>
  );
}
