/*
 * FILE    : apps/web/components/RecruitingDivision.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_1700 UTC
 * PURPOSE : Hub → Recruiting controls: create a role on our own team (NewRoleForm), an opening's Indeed posting —
 *           paste the Indeed link / mark posted, pause, list on /careers (PostingControls) — and copy buttons for the
 *           Indeed post kit (CopyField), and Pro files' "remind everyone in setup" (RemindAllMissing).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as { error?: string; id?: string; sent?: number; skipped?: number };
  return { ok: r.ok, ...j };
}

export function CopyField({ label, text, multiline = false }: { label: string; text: string; multiline?: boolean }) {
  const [ok, setOk] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between gap-2"><span className="label">{label}</span>
        <button type="button" className="text-xs font-semibold text-brand" onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); } catch { /* blocked */ } }}>{ok ? "Copied ✓" : "Copy"}</button></div>
      {multiline ? <textarea readOnly className="input mt-1 h-40 font-mono text-xs" value={text} /> : <input readOnly className="input mt-1 font-mono text-xs" value={text} />}
    </div>
  );
}

export function PostingControls({ okey, indeedUrl, paused, isPublic, track }: { okey: string; indeedUrl: string | null; paused: boolean; isPublic: boolean; track: string }) {
  const router = useRouter();
  const [url, setUrl] = useState(indeedUrl ?? "");
  const [msg, setMsg] = useState("");
  const act = async (body: Record<string, unknown>, done: string) => { const r = await post("/api/hub/recruiting/postings", { key: okey, ...body }); setMsg(r.ok ? done : r.error ?? "Failed"); router.refresh(); };
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-end gap-2">
        <label className="block min-w-64 flex-1"><span className="label">Indeed job link (after you post it)</span><input className="input" placeholder="https://www.indeed.com/viewjob?jk=…" value={url} onChange={(e) => setUrl(e.target.value)} /></label>
        <button type="button" className="btn-primary" onClick={() => act({ indeed_url: url.trim() }, url.trim() ? "Saved — marked as posted on Indeed" : "Link cleared")}>Save</button>
        {!indeedUrl && <button type="button" className="btn-ghost" onClick={() => act({ posted: true }, "Marked as posted")}>Posted (no link)</button>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={() => act({ paused: !paused }, paused ? "Reopened" : "Paused")}>{paused ? "▶ Reopen" : "⏸ Pause"}</button>
        {track !== "pro" && <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={() => act({ public: !isPublic }, isPublic ? "Hidden from /careers" : "Listed on /careers")}>{isPublic ? "Hide from careers page" : "List on careers page"}</button>}
        {indeedUrl && <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={() => { setUrl(""); act({ posted: false }, "Marked as not posted"); }}>Not on Indeed anymore</button>}
      </div>
      {msg && <p className="text-xs">{msg}</p>}
    </div>
  );
}

export function NewRoleForm() {
  const router = useRouter();
  const blank = { title: "", location: "Detroit, MI", workplace: "onsite", salary_min: "", salary_max: "", openings: "1", description: "", must_haves: "", public: true };
  const [f, setF] = useState(blank);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="card space-y-3 text-sm">
      <div className="font-semibold">New role on the Handled team</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="label">Job title *</span><input className="input" value={f.title} onChange={set("title")} placeholder="Dispatcher, Recruiter, Customer success…" /></label>
        <label className="block"><span className="label">Location</span><input className="input" value={f.location} onChange={set("location")} /></label>
        <label className="block"><span className="label">Where</span><select className="input" value={f.workplace} onChange={set("workplace")}><option value="onsite">On site</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option></select></label>
        <label className="block"><span className="label">How many people</span><input className="input" inputMode="numeric" value={f.openings} onChange={set("openings")} /></label>
        <label className="block"><span className="label">Pay from ($/year)</span><input className="input" inputMode="numeric" value={f.salary_min} onChange={set("salary_min")} /></label>
        <label className="block"><span className="label">Pay to ($/year)</span><input className="input" inputMode="numeric" value={f.salary_max} onChange={set("salary_max")} /></label>
      </div>
      <label className="block"><span className="label">What the job is</span><textarea className="input min-h-24" value={f.description} onChange={set("description")} /></label>
      <label className="block"><span className="label">Must-haves (one per line)</span><textarea className="input min-h-20" value={f.must_haves} onChange={set("must_haves")} /></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={f.public} onChange={(e) => setF({ ...f, public: e.target.checked })} /> List it on the public careers page (Indeed applicants apply there)</label>
      <button type="button" className="btn-primary" disabled={busy || f.title.trim().length < 3} onClick={async () => {
        setBusy(true);
        const r = await post("/api/hub/recruiting/roles", { ...f, salary_min: f.salary_min ? Number(f.salary_min) : undefined, salary_max: f.salary_max ? Number(f.salary_max) : undefined, openings: Number(f.openings) || 1 });
        setBusy(false);
        if (!r.ok) return setMsg(r.error ?? "Failed");
        setMsg("Role created — post it on Indeed from the Indeed tab."); setF(blank); router.refresh();
      }}>{busy ? "Creating…" : "Create role"}</button>
      {msg && <p>{msg}</p>}
    </div>
  );
}

/** Pro files: email every pro in setup the items they're still missing (skips anyone reminded in the last 2 days). */
export function RemindAllMissing({ count }: { count: number }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  if (!count) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      {msg && <span className="text-xs">{msg}</span>}
      <button type="button" className="btn-primary" disabled={busy} onClick={async () => {
        if (!confirm(`Email up to ${count} pro(s) in setup the items they're missing?`)) return;
        setBusy(true);
        const r = await post("/api/hub/recruiting/files", { action: "remind_missing" }) as { ok: boolean; error?: string; sent?: number; skipped?: number };
        setBusy(false); setMsg(r.ok ? `Sent ${r.sent ?? 0} · skipped ${r.skipped ?? 0} (reminded in the last 2 days)` : r.error ?? "Failed"); router.refresh();
      }}>{busy ? "Sending…" : `📨 Remind everyone in setup (${count})`}</button>
    </div>
  );
}
