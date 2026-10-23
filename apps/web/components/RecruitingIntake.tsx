/*
 * FILE    : apps/web/components/RecruitingIntake.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-23_1100 UTC
 * PURPOSE : Hub → Recruiting → Add candidates: one candidate by hand, or a CSV import (Indeed's candidate export, a
 *           spreadsheet, another ATS). Both go through api/hub/recruiting/candidates (dedupe, optional confirmation email,
 *           optional AI screen → interview / invite / ask staff, like a /pros application).
 *           TradesEditor: set a candidate's trades on their page (Indeed / imported candidates whose job title didn't say).
 * UPDATED : 2026-10-23_1900 UTC — Skills: after picking trades, check off what the candidate does within each trade
 *           (lawn: mowing, edging, landscaping, shrubs, planting, sod…), on both the add form and the candidate page.
 * UPDATED : 2026-10-23_2300 UTC — ResumeUpload: staff upload or replace a candidate's résumé on their page.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TRADE_PROFILES } from "@handled/core";

type Trade = { id: string; label: string };
type Outcome = { added: number; updated: number; existing_pro: number; duplicate: number; failed: string[]; skipped: { row: number; reason: string }[] };

const SOURCES = ["indeed", "referral", "job fair", "facebook", "craigslist", "walk-in", "phone call", "added by staff"];

/** Skill chips for each picked trade (TRADE_PROFILES specialties), grouped under the trade's name. */
function SkillPicker({ trades, labels, value, onChange }: { trades: string[]; labels: Trade[]; value: string[]; onChange: (v: string[]) => void }) {
  const groups = trades.map((t) => ({ t, label: labels.find((x) => x.id === t)?.label ?? t, skills: TRADE_PROFILES[t]?.specialties ?? [] })).filter((g) => g.skills.length);
  if (!groups.length) return null;
  const flip = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="space-y-1.5">
      <span className="label">Skills (check everything they do)</span>
      {groups.map((g) => (
        <div key={g.t}>
          <div className="text-xs font-semibold text-ink-soft">{g.label}</div>
          <div className="mt-0.5 flex flex-wrap gap-1.5">{g.skills.map((s) => (
            <label key={s.id} className={`flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${value.includes(s.id) ? "border-brand bg-brand-tint font-semibold" : "border-line"}`}>
              <input type="checkbox" className="h-3 w-3" checked={value.includes(s.id)} onChange={() => flip(s.id)} />{s.label}
            </label>
          ))}</div>
        </div>
      ))}
    </div>
  );
}

/** Skills still valid for these trades. */
const keepSkills = (skills: string[], trades: string[]) => skills.filter((s) => trades.some((t) => TRADE_PROFILES[t]?.specialties.some((x) => x.id === s)));

async function send(body: unknown): Promise<{ ok: boolean; json: Outcome & { error?: string } }> {
  const r = await fetch("/api/hub/recruiting/candidates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: r.ok, json: await r.json().catch(() => ({})) };
}

function summary(o: Outcome) {
  const parts = [`${o.added} added`];
  if (o.updated) parts.push(`${o.updated} updated (already applied)`);
  if (o.existing_pro) parts.push(`${o.existing_pro} already a pro`);
  if (o.duplicate) parts.push(`${o.duplicate} already imported`);
  if (o.skipped.length) parts.push(`${o.skipped.length} skipped`);
  if (o.failed.length) parts.push(`${o.failed.length} failed`);
  return parts.join(" · ");
}

export function RecruitingIntake({ trades }: { trades: Trade[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"one" | "csv">("one");
  const [f, setF] = useState({ full_name: "", email: "", phone: "", business_name: "", zips: "", years_experience: "", notes: "", source: "indeed", trades: [] as string[], specialties: [] as string[] });
  const [csv, setCsv] = useState("");
  const [csvSource, setCsvSource] = useState("indeed");
  const [confirm, setConfirm] = useState(true);
  const [screen, setScreen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ ok: boolean; text: string; detail?: Outcome } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const toggle = (id: string) => { const trades = f.trades.includes(id) ? f.trades.filter((t) => t !== id) : [...f.trades, id].slice(0, 5); setF({ ...f, trades, specialties: keepSkills(f.specialties, trades) }); };

  async function submit() {
    setBusy(true); setOut(null);
    const r = tab === "one"
      ? await send({ mode: "one", ...f, years_experience: f.years_experience ? Number(f.years_experience) : undefined, confirm, screen })
      : await send({ mode: "csv", csv, source: csvSource, confirm, screen });
    setBusy(false);
    if (!r.ok) return setOut({ ok: false, text: r.json.error ?? "Couldn't add" });
    setOut({ ok: true, text: summary(r.json), detail: r.json });
    if (tab === "one" && r.json.added + r.json.updated > 0) setF({ ...f, full_name: "", email: "", phone: "", business_name: "", zips: "", years_experience: "", notes: "", trades: [], specialties: [] });
    if (tab === "csv") setCsv("");
    router.refresh();
  }

  return (
    <div className="card space-y-3 text-sm">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setTab("one")} className={`rounded-full border px-3 py-1 ${tab === "one" ? "border-brand bg-brand-tint font-semibold" : "border-line"}`}>Add one candidate</button>
        <button type="button" onClick={() => setTab("csv")} className={`rounded-full border px-3 py-1 ${tab === "csv" ? "border-brand bg-brand-tint font-semibold" : "border-line"}`}>Import a list (CSV)</button>
      </div>

      {tab === "one" ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="label">Full name *</span><input className="input" value={f.full_name} onChange={set("full_name")} /></label>
            <label className="block"><span className="label">Email *</span><input className="input" type="email" value={f.email} onChange={set("email")} /></label>
            <label className="block"><span className="label">Phone</span><input className="input" inputMode="tel" value={f.phone} onChange={set("phone")} /></label>
            <label className="block"><span className="label">Business name (if they have one)</span><input className="input" value={f.business_name} onChange={set("business_name")} /></label>
            <label className="block"><span className="label">ZIPs they cover</span><input className="input" value={f.zips} onChange={set("zips")} placeholder="48201, 48226" /></label>
            <label className="block"><span className="label">Years of experience</span><input className="input" inputMode="numeric" value={f.years_experience} onChange={set("years_experience")} /></label>
            <label className="block"><span className="label">Where they came from</span><select className="input" value={f.source} onChange={set("source")}>{SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          </div>
          <div>
            <span className="label">Trades (up to 5)</span>
            <div className="mt-1 flex flex-wrap gap-1.5">{trades.map((t) => (
              <button key={t.id} type="button" onClick={() => toggle(t.id)} className={`rounded-full border px-2.5 py-0.5 text-xs ${f.trades.includes(t.id) ? "border-brand bg-brand text-white" : "border-line"}`}>{t.label}</button>
            ))}</div>
          </div>
          <SkillPicker trades={f.trades} labels={trades} value={f.specialties} onChange={(specialties) => setF({ ...f, specialties })} />
          <label className="block"><span className="label">Notes (job they applied for, résumé highlights, how you met)</span><textarea className="input min-h-20" value={f.notes} onChange={set("notes")} /></label>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-ink-soft">Indeed: <b>Employer dashboard → Candidates → select → Export</b> (CSV), then upload it here. Any CSV works with a header row that has a <b>Name</b> (or First/Last name) and an <b>Email</b> column; Phone, Job title, Location, ZIP, Trades, Skills, Experience and Notes are picked up when present. Trades and skills are read from the job title, Skills and Notes.</p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block"><span className="label">CSV file</span><input type="file" accept=".csv,text/csv,text/plain" className="text-xs" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setCsv(await file.text()); }} /></label>
            <label className="block"><span className="label">Source for these candidates</span><select className="input" value={csvSource} onChange={(e) => setCsvSource(e.target.value)}>{SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          </div>
          <label className="block"><span className="label">…or paste the CSV</span><textarea className="input min-h-28 font-mono text-xs" value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"Name,Email,Phone,Job title\nAna Ruiz,ana@example.com,313-555-0100,Independent House Cleaner"} /></label>
          {csv && <p className="text-xs text-ink-soft">{Math.max(0, csv.trim().split(/\r?\n/).length - 1)} row(s) ready.</p>}
        </div>
      )}

      <label className="flex items-center gap-2"><input type="checkbox" checked={screen} onChange={(e) => setScreen(e.target.checked)} /> Screen and follow up automatically (AI screen, then the interview link or a decision for you — same as a website application)</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> Email them that we got their application and what happens next</label>
      <button className="btn-primary" disabled={busy || (tab === "one" ? !f.full_name.trim() || !f.email.trim() : !csv.trim())} onClick={submit}>{busy ? "Adding…" : tab === "one" ? "Add to pipeline" : "Import candidates"}</button>
      {out && (
        <div className={`rounded-xl p-3 ${out.ok ? "bg-brand-tint text-brand-dark" : "bg-rose-50 text-rose-800"}`}>
          {out.ok ? "✓ " : ""}{out.text}
          {out.detail && (out.detail.skipped.length > 0 || out.detail.failed.length > 0) && (
            <ul className="mt-1 list-disc pl-5 text-xs">
              {out.detail.skipped.slice(0, 20).map((s) => <li key={`s${s.row}`}>Row {s.row}: {s.reason}</li>)}
              {out.detail.failed.slice(0, 20).map((x) => <li key={x}>{x}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Candidate page: pick the trades and skills (PATCH api/hub/applications/[id]). */
export function TradesEditor({ appId, initial, initialSkills = [], trades }: { appId: string; initial: string[]; initialSkills?: string[]; trades: Trade[] }) {
  const router = useRouter();
  const [sel, setSel] = useState(initial);
  const [skills, setSkills] = useState(initialSkills);
  const [msg, setMsg] = useState("");
  const toggle = (id: string) => { const next = sel.includes(id) ? sel.filter((t) => t !== id) : [...sel, id].slice(0, 5); setSel(next); setSkills(keepSkills(skills, next)); };
  return (
    <details className="mt-2 text-xs" open={!initial.length || !initialSkills.length}>
      <summary className="cursor-pointer font-semibold text-brand">{!initial.length ? "⚠ Set this candidate's trades" : initialSkills.length ? "Change trades & skills" : "⚠ Check off this candidate's skills"}</summary>
      <div className="mt-2 flex flex-wrap gap-1.5">{trades.map((t) => (
        <button key={t.id} type="button" onClick={() => toggle(t.id)} className={`rounded-full border px-2.5 py-0.5 ${sel.includes(t.id) ? "border-brand bg-brand text-white" : "border-line"}`}>{t.label}</button>
      ))}</div>
      <div className="mt-2"><SkillPicker trades={sel} labels={trades} value={skills} onChange={setSkills} /></div>
      <button className="btn-primary mt-2 px-3 py-1 text-xs" disabled={!sel.length} onClick={async () => {
        const r = await fetch(`/api/hub/applications/${appId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trades: sel, specialties: skills }) });
        setMsg(r.ok ? "Saved" : ((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Failed"); router.refresh();
      }}>Save trades & skills</button> {msg && <span className="ml-2">{msg}</span>}
    </details>
  );
}

/** Candidate page: upload or replace the résumé (POST api/hub/applications/[id]/resume). */
export function ResumeUpload({ appId, has }: { appId: string; has: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <label className={`mt-1 inline-block cursor-pointer text-xs font-semibold text-brand underline ${busy ? "opacity-50" : ""}`}>
      {busy ? "Uploading…" : has ? "Replace résumé" : "📎 Upload résumé"}
      <input type="file" accept=".pdf,.doc,.docx,.txt,.rtf,application/pdf" className="hidden" disabled={busy} onChange={async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setBusy(true); setMsg("");
        const fd = new FormData(); fd.append("file", f);
        const r = await fetch(`/api/hub/applications/${appId}/resume`, { method: "POST", body: fd });
        setBusy(false);
        setMsg(r.ok ? "Saved" : ((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Upload failed");
        e.target.value = "";
        router.refresh();
      }} />
      {msg && <span className="ml-2 font-normal no-underline text-ink-soft">{msg}</span>}
    </label>
  );
}
