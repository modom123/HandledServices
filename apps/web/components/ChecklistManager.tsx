/*
 * FILE    : apps/web/components/ChecklistManager.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-11_2250 UTC
 * PURPOSE : Hub → Checklists tools (client): pick one checklist (built-in or saved), attach it to a job, email it to a pro,
 *           and create / edit / delete saved checklists. Also the small "use a different checklist / email it" box on
 *           the Hub job page (JobChecklistTools). Everything goes through /api/hub/checklists.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChecklistDraft } from "@handled/core";

export type ChecklistOption = { group: string; items: { value: string; label: string }[] };
type Pro = { id: string; name: string };

async function post(body: unknown) {
  const r = await fetch("/api/hub/checklists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, j: j as { error?: string; id?: string; name?: string; kept?: number; to?: string; jobId?: string } };
}

/** The one dropdown: choosing a checklist opens it (?c=). */
export function ChecklistPicker({ options, value }: { options: ChecklistOption[]; value: string }) {
  const router = useRouter();
  return (
    <select className="input w-full max-w-md" value={value} onChange={(e) => router.push(`/hub/checklists?c=${encodeURIComponent(e.target.value)}`)} aria-label="Choose a checklist">
      {options.map((g) => <optgroup key={g.group} label={g.group}>{g.items.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>)}
    </select>
  );
}

/** Attach to a job + email to a pro, for the selected checklist. */
export function ChecklistSend({ source, pros }: { source: string; pros: Pro[] }) {
  const [job, setJob] = useState(""), [pro, setPro] = useState(""), [proJob, setProJob] = useState("");
  const [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const run = async (body: unknown, done: (j: Awaited<ReturnType<typeof post>>["j"]) => string) => {
    setBusy(true); setMsg("");
    const r = await post(body);
    setBusy(false); setMsg(r.ok ? done(r.j) : r.j.error ?? "Failed");
  };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card space-y-2">
        <h3 className="font-bold">Attach to a job</h3>
        <p className="text-xs text-ink-soft">Replaces the job's checklist. Items the pro already checked stay checked if they're on the new list.</p>
        <div className="flex gap-2"><input className="input" placeholder="Job ref, e.g. H-1042" value={job} onChange={(e) => setJob(e.target.value)} />
          <button className="btn-primary whitespace-nowrap" disabled={busy || job.trim().length < 3} onClick={() => run({ action: "attach", job: job.trim(), source }, (j) => `Attached "${j.name}" to ${job.trim().toUpperCase()}${j.kept ? ` · ${j.kept} checked item(s) kept` : ""}`)}>Attach</button></div>
      </div>
      <div className="card space-y-2">
        <h3 className="font-bold">Email to a pro</h3>
        <select className="input" value={pro} onChange={(e) => setPro(e.target.value)}><option value="">Choose a pro…</option>{pros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <div className="flex gap-2"><input className="input" placeholder="For job (optional), e.g. H-1042" value={proJob} onChange={(e) => setProJob(e.target.value)} />
          <button className="btn-primary whitespace-nowrap" disabled={busy || !pro} onClick={() => run({ action: "email", contractor_id: pro, source, job: proJob.trim() || null }, (j) => `Emailed to ${j.to}`)}>Send</button></div>
        <p className="text-xs text-ink-soft">Sent in the pro's language, with the job ref when you give one.</p>
      </div>
      {msg && <p className="text-sm md:col-span-2">{msg}</p>}
    </div>
  );
}

const blank = (): ChecklistDraft => ({ title: "", sections: [{ title: "The work", items: [{ text: "", required: true }] }] });

/** Create or edit a saved checklist (a built-in one opens as a copy). */
export function ChecklistEditor({ initial, id, name: initialName, serviceSlug, services }: { initial?: ChecklistDraft; id?: string; name?: string; serviceSlug?: string | null; services: { slug: string; name: string }[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<ChecklistDraft>(initial ?? blank());
  const [name, setName] = useState(initialName ?? (initial?.title ? `${initial.title} (custom)` : ""));
  const [svc, setSvc] = useState(serviceSlug ?? "");
  const [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const set = (fn: (d: ChecklistDraft) => void) => setDraft((d) => { const c = structuredClone(d); fn(c); return c; });
  const save = async () => {
    setBusy(true); setMsg("");
    const r = await post({ action: "save", id, name: name.trim(), service_slug: svc || null, draft: { ...draft, title: draft.title || name } });
    setBusy(false);
    if (!r.ok) return setMsg(r.j.error ?? "Failed");
    setMsg("Saved");
    router.push(`/hub/checklists?c=s:${r.j.id ?? id}`);
    router.refresh();
  };
  const remove = async () => {
    if (!id || !confirm(`Delete "${initialName}"? Jobs that already use it keep their copy.`)) return;
    const r = await post({ action: "delete", id });
    if (r.ok) { router.push("/hub/checklists"); router.refresh(); } else setMsg(r.j.error ?? "Failed");
  };
  return (
    <div className="card space-y-4">
      <div className="grid gap-2 md:grid-cols-3">
        <label className="text-sm md:col-span-1"><span className="label">Name in the list</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Office nightly clean" /></label>
        <label className="text-sm md:col-span-1"><span className="label">Title the pro sees</span><input className="input" value={draft.title} onChange={(e) => set((d) => { d.title = e.target.value; })} placeholder="Defaults to the name" /></label>
        <label className="text-sm md:col-span-1"><span className="label">Service (optional)</span><select className="input" value={svc} onChange={(e) => setSvc(e.target.value)}><option value="">Any service</option>{services.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}</select></label>
      </div>
      {draft.sections.map((sec, si) => (
        <div key={si} className="rounded-xl border border-line p-3">
          <div className="flex gap-2"><input className="input font-semibold" value={sec.title} onChange={(e) => set((d) => { d.sections[si].title = e.target.value; })} placeholder="Section, e.g. Kitchen" />
            <button type="button" className="text-xs text-rose-700 underline" onClick={() => set((d) => { d.sections.splice(si, 1); })}>Remove section</button></div>
          <ul className="mt-2 space-y-2">{sec.items.map((it, ii) => (
            <li key={ii} className="flex flex-wrap items-center gap-2">
              <input className="input min-w-0 flex-1" value={it.text} onChange={(e) => set((d) => { d.sections[si].items[ii].text = e.target.value; })} placeholder="What done looks like, e.g. Counters wiped and sanitized" />
              <label className="text-xs"><input type="checkbox" checked={Boolean(it.required)} onChange={(e) => set((d) => { d.sections[si].items[ii].required = e.target.checked; })} /> required</label>
              <label className="text-xs"><input type="checkbox" checked={Boolean(it.photo)} onChange={(e) => set((d) => { d.sections[si].items[ii].photo = e.target.checked; })} /> photo</label>
              <button type="button" className="text-xs text-ink-soft underline" onClick={() => set((d) => { d.sections[si].items.splice(ii, 1); })}>✕</button>
            </li>
          ))}</ul>
          <button type="button" className="mt-2 text-sm text-brand underline" onClick={() => set((d) => { d.sections[si].items.push({ text: "", required: false }); })}>+ Add item</button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="text-sm text-brand underline" onClick={() => set((d) => { d.sections.push({ title: "", items: [{ text: "", required: false }] }); })}>+ Add section</button>
        <button className="btn-primary" disabled={busy || name.trim().length < 2} onClick={save}>{id ? "Save changes" : "Save checklist"}</button>
        {id && <button type="button" className="text-sm text-rose-700 underline" onClick={remove}>Delete</button>}
        {msg && <span className="text-sm">{msg}</span>}
      </div>
      <p className="text-xs text-ink-soft">Describe the result the customer paid for, not how to work — pros choose their own methods. Spanish-speaking pros see the English text until a Spanish version is added.</p>
    </div>
  );
}

/** On the Hub job page: swap the job's checklist or email it to a pro. */
export function JobChecklistTools({ jobId, jobRef, options, assignedPro, pros }: { jobId: string; jobRef: string; options: ChecklistOption[]; assignedPro: string | null; pros: Pro[] }) {
  const router = useRouter();
  const [src, setSrc] = useState(""), [pro, setPro] = useState(assignedPro ?? ""), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const run = async (body: unknown, done: (j: Awaited<ReturnType<typeof post>>["j"]) => string) => {
    setBusy(true); setMsg("");
    const r = await post(body);
    setBusy(false); setMsg(r.ok ? done(r.j) : r.j.error ?? "Failed");
    if (r.ok) router.refresh();
  };
  return (
    <div className="space-y-2 rounded-xl bg-paper p-3 text-sm">
      <div className="flex flex-wrap gap-2">
        <select className="input h-9 w-auto min-w-0 flex-1 py-0" value={src} onChange={(e) => setSrc(e.target.value)} aria-label="Use a different checklist">
          <option value="">Use a different checklist…</option>
          {options.map((g) => <optgroup key={g.group} label={g.group}>{g.items.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>)}
        </select>
        <button className="btn-ghost h-9 py-0" disabled={busy || !src} onClick={() => run({ action: "attach", job: jobId, source: src }, (j) => `Now using "${j.name}"`)}>Attach</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <select className="input h-9 w-auto min-w-0 flex-1 py-0" value={pro} onChange={(e) => setPro(e.target.value)} aria-label="Email the checklist to a pro">
          <option value="">Email this job's checklist to…</option>{pros.map((p) => <option key={p.id} value={p.id}>{p.name}{p.id === assignedPro ? " (on the job)" : ""}</option>)}
        </select>
        <button className="btn-ghost h-9 py-0" disabled={busy || !pro} onClick={() => run({ action: "email", contractor_id: pro, source: "job", job: jobRef }, (j) => `Emailed to ${j.to}`)}>Email</button>
      </div>
      {msg && <p className="text-xs">{msg}</p>}
    </div>
  );
}
