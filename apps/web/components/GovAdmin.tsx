/*
 * FILE    : apps/web/components/GovAdmin.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_1441 UTC
 * PURPOSE : Hub → Gov contracts controls: the saved daily SAM.gov search (and run a search now), pipeline status and
 *           notes per notice, full text + AI bid brief, and asking matching pros whether they want the work.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GOV_NAICS, SAM_NOTICE_TYPES, SET_ASIDES } from "@handled/core";

async function post(body: unknown): Promise<{ ok: boolean; [k: string]: unknown }> {
  const r = await fetch("/api/hub/gov", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ...j, ok: r.ok && j.ok !== false, error: j.error };
}

export interface GovSearchState { enabled: boolean; naics: string[]; state: string | null; keywords: string | null; ptypes: string[]; days_back: number; daily_call_budget: number; certifications: string[] }

const toggle = (list: string[], x: string) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

/** The saved search (runs every weekday when on) and "Search now" with the same fields. */
export function GovSearchForm({ s, ready, callsLeft }: { s: GovSearchState; ready: boolean; callsLeft: number }) {
  const router = useRouter();
  const [f, setF] = useState<GovSearchState>(s);
  const [setAside, setSetAside] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const calls = Math.max(1, f.naics.length);
  return (
    <div className="space-y-4 text-sm">
      <div>
        <div className="label">Work we can fill (NAICS codes) — one SAM.gov call each</div>
        <div className="flex flex-wrap gap-2">
          {GOV_NAICS.map((n) => (
            <button key={n.code} type="button" onClick={() => setF({ ...f, naics: toggle(f.naics, n.code) })} className={`rounded-full border px-3 py-1 text-xs ${f.naics.includes(n.code) ? "border-brand bg-brand-tint font-semibold" : "border-line"}`}>{n.code} · {n.title}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div><label className="label">State (place of work)</label><input className="input" maxLength={2} value={f.state ?? ""} onChange={(e) => setF({ ...f, state: e.target.value.toUpperCase() || null })} placeholder="MI" /></div>
        <div><label className="label">Title keywords</label><input className="input" value={f.keywords ?? ""} onChange={(e) => setF({ ...f, keywords: e.target.value })} placeholder="e.g. janitorial, snow" /></div>
        <div><label className="label">Posted in the last (days)</label><input className="input" type="number" min={1} max={364} value={f.days_back} onChange={(e) => setF({ ...f, days_back: Number(e.target.value) || 7 })} /></div>
        <div><label className="label">Daily SAM.gov call budget</label><input className="input" type="number" min={1} max={1000} value={f.daily_call_budget} onChange={(e) => setF({ ...f, daily_call_budget: Number(e.target.value) || 8 })} /></div>
      </div>
      <div>
        <div className="label">Notice types</div>
        <div className="flex flex-wrap gap-3">
          {Object.entries(SAM_NOTICE_TYPES).filter(([k]) => k !== "g" && k !== "i").map(([k, label]) => (
            <label key={k} className="flex items-center gap-1"><input type="checkbox" checked={f.ptypes.includes(k)} onChange={() => setF({ ...f, ptypes: toggle(f.ptypes, k) })} /> {label}</label>
          ))}
        </div>
      </div>
      <div>
        <div className="label">Certifications Handled holds (unlocks those set-asides)</div>
        <div className="flex flex-wrap gap-3">
          {Object.entries(SET_ASIDES).filter(([, v]) => v.kind === "cert").map(([k, v]) => (
            <label key={k} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={f.certifications.includes(k)} onChange={() => setF({ ...f, certifications: toggle(f.certifications, k) })} /> {v.label}</label>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} /> Run this search every weekday morning</label>
        <button className="btn-ghost" disabled={busy} onClick={async () => {
          setBusy(true); setMsg("");
          const r = await post({ action: "settings", ...f, keywords: f.keywords || null });
          setBusy(false); setMsg(r.ok ? "Saved." : String(r.error ?? "Failed")); router.refresh();
        }}>Save search</button>
        <select className="input w-auto" value={setAside} onChange={(e) => setSetAside(e.target.value)}>
          <option value="">Any set-aside</option>
          {Object.entries(SET_ASIDES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button className="btn-primary" disabled={busy || !ready || callsLeft < 1} onClick={async () => {
          setBusy(true); setMsg("Searching SAM.gov…");
          const r = await post({ action: "search", naics: f.naics, state: f.state, keywords: f.keywords || null, ptypes: f.ptypes, days_back: f.days_back, set_aside: setAside || null });
          setBusy(false);
          const res = r.result as { calls: number; found: number; added: number; skipped: number; errors: string[] } | undefined;
          setMsg(r.ok && res ? `${res.found} found, ${res.added} new · ${res.calls} call${res.calls === 1 ? "" : "s"} used${res.skipped ? ` · ${res.skipped} code(s) skipped: budget used up` : ""}${res.errors.length ? ` · ${res.errors[0]}` : ""}` : String(r.error ?? "Failed"));
          router.refresh();
        }}>Search now ({calls} call{calls === 1 ? "" : "s"})</button>
        <span className="text-xs text-ink-soft">{callsLeft} call{callsLeft === 1 ? "" : "s"} left today</span>
      </div>
      {msg && <p className="text-ink-soft">{msg}</p>}
    </div>
  );
}

const STATUSES = ["new", "reviewing", "bidding", "submitted", "won", "lost", "passed"] as const;

export function GovStatus({ id, status, notes }: { id: string; status: string; notes: string | null }) {
  const router = useRouter();
  const [st, setSt] = useState(status);
  const [n, setN] = useState(notes ?? "");
  const [msg, setMsg] = useState("");
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((x) => (
          <button key={x} className={`rounded-full border px-3 py-1 text-xs capitalize ${st === x ? "border-brand bg-brand-tint font-semibold" : "border-line"}`} onClick={async () => { setSt(x); const r = await post({ action: "status", notice_id: id, status: x }); setMsg(r.ok ? "" : String(r.error)); router.refresh(); }}>{x}</button>
        ))}
      </div>
      <textarea className="input min-h-24" placeholder="Notes: questions for the contracting officer, pricing, who's covering what…" value={n} onChange={(e) => setN(e.target.value)} />
      <button className="btn-ghost" onClick={async () => { const r = await post({ action: "status", notice_id: id, notes: n || null }); setMsg(r.ok ? "Saved." : String(r.error)); }}>Save notes</button>
      {msg && <span className="ml-2 text-ink-soft">{msg}</span>}
    </div>
  );
}

/** Fetch the full notice text, then the AI bid brief. */
export function GovReadButtons({ id, hasText, hasSummary, aiReady }: { id: string; hasText: boolean; hasSummary: boolean; aiReady: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const run = async (action: "describe" | "summarize") => {
    setBusy(action); setMsg("");
    const r = await post({ action, notice_id: id });
    setBusy(""); setMsg(r.ok ? "" : String(r.error ?? "Failed")); router.refresh();
  };
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {!hasText && <button className="btn-ghost" disabled={Boolean(busy)} onClick={() => run("describe")}>{busy === "describe" ? "Loading…" : "Load the full notice (1 call)"}</button>}
      <button className="btn-primary" disabled={Boolean(busy) || !aiReady} onClick={() => run("summarize")}>{busy === "summarize" ? "Reading the notice…" : hasSummary ? "Redo the AI bid brief" : "✨ AI bid brief"}</button>
      {!aiReady && <span className="text-xs text-ink-soft">Set ANTHROPIC_API_KEY for the AI brief.</span>}
      {msg && <span className="text-rose-700">{msg}</span>}
    </div>
  );
}

export interface GovProRow { id: string; business_name: string; contact_name: string | null; email: string | null; phone: string | null; rating: number | null; jobs_completed: number | null; interest: { status: string; note: string | null } | null }

/** Matching pros: pick and email them, then record each answer. */
export function GovPros({ id, pros }: { id: string; pros: GovProRow[] }) {
  const router = useRouter();
  const [pick, setPick] = useState<string[]>(pros.filter((p) => !p.interest && p.email).slice(0, 10).map((p) => p.id));
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  if (!pros.length) return <p className="text-sm text-ink-soft">No approved pros match this work yet. Recruit for it in Hub → Recruiting, or look for small businesses that do it (they can join as pros).</p>;
  return (
    <div className="space-y-3 text-sm">
      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3"></th><th className="p-3">Pro</th><th className="p-3">Contact</th><th className="p-3">Answer</th></tr></thead>
          <tbody>
            {pros.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="p-3"><input type="checkbox" disabled={!p.email} checked={pick.includes(p.id)} onChange={() => setPick(toggle(pick, p.id))} /></td>
                <td className="p-3"><div className="font-semibold">{p.business_name}</div><div className="text-xs text-ink-soft">{p.rating ? `${p.rating}★` : "new"} · {p.jobs_completed ?? 0} jobs</div></td>
                <td className="p-3 text-xs">{p.contact_name ?? ""}<div>{p.email ?? "no email"}</div><div>{p.phone ?? ""}</div></td>
                <td className="p-3 text-xs">
                  <select className="input w-auto py-1 text-xs" value={p.interest?.status ?? ""} onChange={async (e) => { if (!e.target.value) return; await post({ action: "interest", notice_id: id, contractor_id: p.id, status: e.target.value }); router.refresh(); }}>
                    <option value="">Not asked</option><option value="asked">Asked</option><option value="interested">Interested</option><option value="not_interested">Not interested</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" disabled={busy || !pick.length} onClick={async () => {
          if (!confirm(`Email ${pick.length} pro(s) about this opportunity?`)) return;
          setBusy(true);
          const r = await post({ action: "ask_pros", notice_id: id, contractor_ids: pick });
          setBusy(false); setMsg(r.ok ? `Emailed ${r.sent} pro(s). Their replies come to your inbox; record each answer above.` : String(r.error ?? "Failed")); setPick([]); router.refresh();
        }}>Ask {pick.length} pro{pick.length === 1 ? "" : "s"} if they want this work</button>
        {msg && <span className="text-ink-soft">{msg}</span>}
      </div>
      <p className="text-xs text-ink-soft">The email says it isn’t an offer of work yet, asks yes/no, capacity, their rate and whether they’re a small business, and explains that a win becomes a written subcontract they can accept or decline.</p>
    </div>
  );
}
