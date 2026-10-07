/*
 * FILE    : apps/web/components/TalentUI.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_2034 UTC
 * PURPOSE : Handled Talent screens (client components):
 *             TalentRequestForm  — /talent: a company starts a search (and accepts the client agreement)
 *             ReviewBoard        — /talent/review/[token]: the client accepts the agreement, reads each candidate's
 *                                  summary and résumé, and chooses interview / pass / hold with feedback
 *             CandidateAnswer    — /talent/candidate/[token]: the candidate confirms or withdraws
 *             Hub + recruiter    — new client / search, terms, status, recruiters, add candidate (résumé upload straight
 *                                  to private storage), submit (consent + write-up), stages, hire, invoice, guarantee exit
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TALENT_STAGE_LABEL, TALENT_TERMS, placementFee, type TalentStage } from "@handled/core";
import { browserClient } from "@/lib/supabase/browser";

async function call(url: string, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; [k: string]: unknown }> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ...j, ok: r.ok && j.ok !== false, error: j.error };
}
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const numOrNull = (s: string) => (s.trim() ? Number(s.replace(/[^\d.]/g, "")) : null);

// ───────────────────────────── public intake ─────────────────────────────

export function TalentRequestForm() {
  const [f, setF] = useState({ company: "", contact_name: "", email: "", phone: "", website: "", city: "", title: "", location: "", workplace: "onsite", salary_min: "", salary_max: "", openings: "1", description: "", must_haves: "", type: "contingency" });
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const inp = (k: keyof typeof f, label: string, extra: Record<string, unknown> = {}) => <div><label className="label">{label}</label><input className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...extra} /></div>;
  if (done) return <div className="card"><h3 className="text-lg font-bold">Thank you — your search is in.</h3><p className="mt-2 text-sm text-ink-soft">A recruiter will call you within one business day for a short intake. Check your email for a confirmation.</p></div>;
  const max = numOrNull(f.salary_max) ?? numOrNull(f.salary_min);
  return (
    <div className="card space-y-4 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">{inp("company", "Company *")}{inp("contact_name", "Your name *")}{inp("email", "Work email *", { type: "email" })}{inp("phone", "Phone")}{inp("website", "Website")}{inp("city", "City")}</div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">{inp("title", "Job title *")}</div>
        <div><label className="label">Workplace</label><select className="input" value={f.workplace} onChange={(e) => setF({ ...f, workplace: e.target.value })}><option value="onsite">On site</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option></select></div>
        {inp("location", "Location")}{inp("salary_min", "Base salary from ($/yr)", { inputMode: "numeric" })}{inp("salary_max", "Base salary to ($/yr)", { inputMode: "numeric" })}
        {inp("openings", "Openings", { inputMode: "numeric" })}
        <div className="sm:col-span-2"><label className="label">Search type</label>
          <div className="flex flex-wrap gap-3 pt-2">
            <label className="flex items-center gap-1"><input type="radio" checked={f.type === "contingency"} onChange={() => setF({ ...f, type: "contingency" })} /> Contingency — {TALENT_TERMS.contingencyPct}%, only if you hire</label>
            <label className="flex items-center gap-1"><input type="radio" checked={f.type === "retained"} onChange={() => setF({ ...f, type: "retained" })} /> Retained — {TALENT_TERMS.retainedPct}%, dedicated search</label>
          </div>
        </div>
      </div>
      <div><label className="label">About the role (what they'll do, who they report to)</label><textarea className="input min-h-28" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      <div><label className="label">Must-haves (skills, licenses, experience)</label><textarea className="input min-h-20" value={f.must_haves} onChange={(e) => setF({ ...f, must_haves: e.target.value })} /></div>
      {max ? <p className="rounded-lg bg-paper p-2 text-xs">At {usd(max)} base, the {f.type === "retained" ? `retained fee would be about ${usd(max * TALENT_TERMS.retainedPct / 100)}, in three payments` : `fee would be ${usd(placementFee(max).fee)}, due ${TALENT_TERMS.invoiceDueDays} days after the start date — and nothing if you don't hire`}.</p> : null}
      <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> <span>I agree to the <a href="/terms/talent-client-agreement" target="_blank" className="text-brand underline">Handled Talent Client Agreement</a> for my company, and I&apos;m authorized to.</span></label>
      <input type="text" name="website_url_hp" className="hidden" tabIndex={-1} autoComplete="off" />
      <button className="btn-primary" disabled={busy || !agree || !f.company || !f.contact_name || !f.email || !f.title} onClick={async () => {
        setBusy(true); setErr("");
        const r = await call("/api/talent/request", { ...f, phone: f.phone || null, website: f.website || null, city: f.city || null, location: f.location || null, salary_min: numOrNull(f.salary_min), salary_max: numOrNull(f.salary_max), openings: Math.max(1, Number(f.openings) || 1), description: f.description || null, must_haves: f.must_haves || null, agree });
        setBusy(false); if (r.ok) setDone(true); else setErr(String(r.error ?? "Something went wrong"));
      }}>Start my search</button>
      {err && <p className="text-rose-700">{err}</p>}
    </div>
  );
}

// ───────────────────────────── client review ─────────────────────────────

type ReviewSub = { id: string; stage: string; pitch: string | null; expected_salary: number | null; submitted_at: string | null; client_feedback: string | null; client_decision: string | null; candidate: { full_name: string; location: string | null; current_title: string | null; linkedin: string | null; hasResume: boolean } };

export function ReviewBoard({ token, signed, subs, agreementUrl }: { token: string; signed: boolean; subs: ReviewSub[]; agreementUrl: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [ok, setOk] = useState(false);
  const [fb, setFb] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  if (!signed) return (
    <div className="card space-y-3 text-sm">
      <h2 className="text-lg font-bold">Before we send candidates</h2>
      <p>Please review and accept the <a href={agreementUrl} target="_blank" className="text-brand underline">Handled Talent Client Agreement</a>: contingency {TALENT_TERMS.contingencyPct}% (only if you hire) or retained {TALENT_TERMS.retainedPct}%, a {TALENT_TERMS.guaranteeDays}-day guarantee, and {TALENT_TERMS.ownershipMonths}-month candidate ownership.</p>
      <div className="grid gap-2 sm:grid-cols-2"><input className="input" placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} /><input className="input" placeholder="Your title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={ok} onChange={(e) => setOk(e.target.checked)} /> I accept the agreement for my company and I&apos;m authorized to.</label>
      <button className="btn-primary" disabled={!ok || name.trim().length < 2} onClick={async () => { const r = await call(`/api/talent/review/${token}`, { action: "accept", name, title: title || null }); if (r.ok) router.refresh(); else setMsg(String(r.error)); }}>Accept and continue</button>
      {msg && <p className="text-rose-700">{msg}</p>}
    </div>
  );
  if (!subs.length) return <p className="card text-sm text-ink-soft">No candidates yet. We&apos;ll email you as soon as we submit someone.</p>;
  return (
    <div className="space-y-3">
      {subs.map((s) => (
        <div key={s.id} className="card space-y-2 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><div className="text-lg font-bold">{s.candidate.full_name}</div><div className="text-ink-soft">{[s.candidate.current_title, s.candidate.location].filter(Boolean).join(" · ")}{s.expected_salary ? ` · looking for about ${usd(s.expected_salary)}` : ""}</div></div>
            <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold">{TALENT_STAGE_LABEL[s.stage as TalentStage] ?? s.stage}</span>
          </div>
          {s.pitch && <p className="whitespace-pre-wrap">{s.pitch}</p>}
          <div className="flex flex-wrap gap-3">
            {s.candidate.hasResume && <button className="text-brand underline" onClick={async () => { const r = await call(`/api/talent/review/${token}`, { action: "resume", submission_id: s.id }); if (r.ok && r.url) window.open(String(r.url), "_blank"); }}>Open résumé</button>}
            {s.candidate.linkedin && <a className="text-brand underline" href={s.candidate.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>}
          </div>
          {!["placed", "withdrawn"].includes(s.stage) && (
            <div className="space-y-2 border-t border-line pt-2">
              <textarea className="input min-h-16" placeholder="Feedback for us (what fits, what's missing)" value={fb[s.id] ?? s.client_feedback ?? ""} onChange={(e) => setFb({ ...fb, [s.id]: e.target.value })} />
              <div className="flex flex-wrap gap-2">
                {(["interview", "hold", "pass"] as const).map((d) => <button key={d} className={d === "interview" ? "btn-primary" : "btn-ghost"} onClick={async () => { const r = await call(`/api/talent/review/${token}`, { action: "decide", submission_id: s.id, decision: d, feedback: fb[s.id] ?? s.client_feedback ?? null }); setMsg(r.ok ? "Thanks — we've let the recruiter know." : String(r.error)); router.refresh(); }}>{d === "interview" ? "Interview" : d === "hold" ? "Hold" : "Pass"}</button>)}
              </div>
            </div>
          )}
        </div>
      ))}
      {msg && <p className="text-sm text-ink-soft">{msg}</p>}
    </div>
  );
}

export function CandidateAnswer({ token }: { token: string }) {
  const [done, setDone] = useState("");
  const send = async (answer: "confirm" | "withdraw") => { const r = await call(`/api/talent/candidate/${token}`, { answer }); setDone(r.ok ? (answer === "confirm" ? "Thanks — you're all set. We'll be in touch with next steps." : "Done — we've withdrawn your résumé from this company.") : String(r.error)); };
  if (done) return <p className="card text-sm">{done}</p>;
  return <div className="card flex flex-wrap gap-2"><button className="btn-primary" onClick={() => send("confirm")}>Yes, I agreed to this</button><button className="btn-ghost" onClick={() => send("withdraw")}>Withdraw my résumé</button></div>;
}

// ───────────────────────────── Hub + recruiter shared ─────────────────────────────

function useAct(url: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const act = async (body: Record<string, unknown>, okMsg = "") => {
    setBusy(true); setMsg("");
    const r = await call(url, body);
    setBusy(false); setMsg(r.ok ? okMsg : String(r.error ?? "Failed"));
    if (r.ok) router.refresh();
    return r;
  };
  return { busy, msg, setMsg, act };
}

/** Add a candidate to a search, with the résumé uploaded straight to private storage. */
export function AddCandidateForm({ url, searchId, recruiters }: { url: string; searchId: string; recruiters?: { id: string; business_name: string }[] }) {
  const empty = { full_name: "", email: "", phone: "", location: "", current_title: "", linkedin: "", summary: "", source: "", expected_salary: "" };
  const [f, setF] = useState(empty);
  const [file, setFile] = useState<File | null>(null);
  const [rec, setRec] = useState<string>("");
  const { busy, msg, setMsg, act } = useAct(url);
  const inp = (k: keyof typeof f, label: string) => <input className="input" placeholder={label} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />;
  return (
    <div className="space-y-2 text-sm">
      <div className="grid gap-2 sm:grid-cols-3">{inp("full_name", "Full name *")}{inp("email", "Email *")}{inp("phone", "Phone")}{inp("current_title", "Current title")}{inp("location", "Location")}{inp("linkedin", "LinkedIn URL")}{inp("expected_salary", "Salary looking for ($/yr)")}{inp("source", "Source (referral, LinkedIn…)")}
        {recruiters && <select className="input" value={rec} onChange={(e) => setRec(e.target.value)}><option value="">Recruiter: Handled staff</option>{recruiters.map((r) => <option key={r.id} value={r.id}>{r.business_name}</option>)}</select>}
      </div>
      <textarea className="input min-h-16" placeholder="Notes (screening notes, availability)" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
      <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-ink-soft">Résumé (PDF or Word):</span><input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-xs" /></div>
      <button className="btn-primary" disabled={busy || f.full_name.length < 2 || !/@/.test(f.email)} onClick={async () => {
        let resume_path: string | null = null;
        if (file) {
          if (file.size > 10 * 1024 * 1024) { setMsg("Résumé must be under 10 MB"); return; }
          const u = await call(url, { action: "upload_url", name: file.name });
          if (!u.ok) { setMsg(String(u.error)); return; }
          const { error } = await browserClient().storage.from("talent").uploadToSignedUrl(String(u.path), String(u.token), file, { contentType: file.type || "application/octet-stream" });
          if (error) { setMsg(error.message); return; }
          resume_path = String(u.path);
        }
        const r = await act({ action: "add_candidate", search_id: searchId, ...(recruiters ? { recruiter_id: rec || null } : {}), full_name: f.full_name, email: f.email, phone: f.phone || null, location: f.location || null, current_title: f.current_title || null, linkedin: f.linkedin || null, summary: f.summary || null, source: f.source || null, expected_salary: numOrNull(f.expected_salary), resume_path }, "Added to the pipeline.");
        if (r.ok) { setF(empty); setFile(null); }
      }}>Add candidate</button>
      {msg && <span className="ml-2 text-ink-soft">{msg}</span>}
    </div>
  );
}

export interface PipeRow { id: string; stage: string; pitch: string | null; submitted_at: string | null; client_feedback: string | null; client_decision: string | null; expected_salary: number | null; recruiter: string | null; mine?: boolean; candidate: { full_name: string; email: string; current_title: string | null; location: string | null; hasResume: boolean } }

/** The pipeline for a search. `who` decides which controls show (recruiter: screen, submit, withdraw; staff: everything). */
export function Pipeline({ url, rows, who, feePct, recruiterPct, minimumFee, type }: { url: string; rows: PipeRow[]; who: "staff" | "recruiter"; feePct: number; recruiterPct: number; minimumFee: number; type: string }) {
  const { busy, msg, act } = useAct(url);
  const [open, setOpen] = useState<string | null>(null);
  const [pitch, setPitch] = useState("");
  const [consent, setConsent] = useState(false);
  const [method, setMethod] = useState("Email / text on");
  const [hire, setHire] = useState({ salary: "", start: "" });
  if (!rows.length) return <p className="text-sm text-ink-soft">No candidates yet.</p>;
  const staffStages: TalentStage[] = ["client_review", "interview", "offer", "rejected", "withdrawn"];
  const sal = numOrNull(hire.salary) ?? 0;
  const fee = type === "retained" ? null : placementFee(sal, { feePct, recruiterPct, minimumFee });
  return (
    <div className="space-y-2 text-sm">
      {rows.map((r) => (
        <div key={r.id} className="rounded-xl border border-line p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <b>{r.candidate.full_name}</b> <span className="text-xs text-ink-soft">{[r.candidate.current_title, r.candidate.location, r.candidate.email].filter(Boolean).join(" · ")}</span>
              <div className="text-xs text-ink-soft">{TALENT_STAGE_LABEL[r.stage as TalentStage] ?? r.stage}{r.recruiter ? ` · ${r.recruiter}` : ""}{r.submitted_at ? ` · submitted ${new Date(r.submitted_at).toLocaleDateString("en-US")}` : ""}{r.expected_salary ? ` · wants ${usd(r.expected_salary)}` : ""}</div>
              {r.client_feedback && <div className="text-xs">Client: <i>{r.client_feedback}</i></div>}
            </div>
            <div className="flex flex-wrap gap-1">
              {r.candidate.hasResume && <button className="btn-ghost py-1 text-xs" onClick={async () => { const x = await call(url, who === "staff" ? { action: "resume_link_sub", submission_id: r.id } : { action: "resume_link", submission_id: r.id }); if (x.ok && x.url) window.open(String(x.url), "_blank"); }}>Résumé</button>}
              {["sourced", "screened"].includes(r.stage) && (who === "staff" || r.mine) && <>
                {r.stage === "sourced" && <button className="btn-ghost py-1 text-xs" disabled={busy} onClick={() => act({ action: "stage", submission_id: r.id, stage: "screened", note: null })}>Mark screened</button>}
                <button className="btn-primary py-1 text-xs" onClick={() => { setOpen(open === `s${r.id}` ? null : `s${r.id}`); setPitch(r.pitch ?? ""); setConsent(false); }}>Submit to client</button>
              </>}
              {who === "staff" && !["sourced", "screened", "placed"].includes(r.stage) && <select className="input w-auto py-1 text-xs" value="" onChange={(e) => e.target.value && void act({ action: "stage", submission_id: r.id, stage: e.target.value, note: null })}><option value="">Move to…</option>{staffStages.filter((s) => s !== r.stage).map((s) => <option key={s} value={s}>{TALENT_STAGE_LABEL[s]}</option>)}</select>}
              {who === "staff" && ["interview", "offer", "client_review", "submitted"].includes(r.stage) && <button className="btn-primary py-1 text-xs" onClick={() => setOpen(open === `h${r.id}` ? null : `h${r.id}`)}>Record hire</button>}
              {who === "recruiter" && r.mine && ["sourced", "screened"].includes(r.stage) && <button className="btn-ghost py-1 text-xs" onClick={() => act({ action: "stage", submission_id: r.id, stage: "withdrawn", note: null })}>Remove</button>}
            </div>
          </div>
          {open === `s${r.id}` && (
            <div className="mt-2 space-y-2 border-t border-line pt-2">
              <textarea className="input min-h-24" placeholder="For the client: why this person fits — experience against the must-haves, availability, salary expectations, why they'd move." value={pitch} onChange={(e) => setPitch(e.target.value)} />
              <div className="grid gap-2 sm:grid-cols-2"><input className="input" placeholder="How they agreed (e.g. email on Oct 5)" value={method} onChange={(e) => setMethod(e.target.value)} /></div>
              <label className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> The candidate agreed in writing to be submitted to this company for this role, and I have that in my records.</label>
              <button className="btn-primary" disabled={busy || !consent || pitch.trim().length < 40} onClick={async () => { const x = await act({ action: "submit", submission_id: r.id, pitch, consent, consent_method: method }, "Submitted — the client and the candidate were emailed."); if (x.ok) setOpen(null); }}>Send to client</button>
              {pitch.trim().length < 40 && <span className="ml-2 text-xs text-ink-soft">Write at least a few sentences.</span>}
            </div>
          )}
          {open === `h${r.id}` && (
            <div className="mt-2 space-y-2 border-t border-line pt-2">
              <div className="grid gap-2 sm:grid-cols-3"><input className="input" placeholder="First-year base salary $" inputMode="numeric" value={hire.salary} onChange={(e) => setHire({ ...hire, salary: e.target.value })} /><input className="input" type="date" value={hire.start} onChange={(e) => setHire({ ...hire, start: e.target.value })} /></div>
              {fee && sal > 0 && <p className="text-xs">Fee {usd(fee.fee)} ({feePct}%) · recruiter {usd(fee.recruiterPay)} · Handled {usd(fee.platform)} · invoiced on the start date, due {TALENT_TERMS.invoiceDueDays} days later.</p>}
              {type === "retained" && <p className="text-xs text-ink-soft">Retained: the final payment is trued up to this salary and invoiced on the start date.</p>}
              <button className="btn-primary" disabled={busy || !(sal >= 1000) || !hire.start} onClick={async () => { const x = await act({ action: "hire", submission_id: r.id, base_salary: sal, start_date: hire.start }, "Hire recorded."); if (x.ok) setOpen(null); }}>Record hire</button>
            </div>
          )}
        </div>
      ))}
      {msg && <p className="text-ink-soft">{msg}</p>}
    </div>
  );
}

// ───────────────────────────── Hub only ─────────────────────────────

const HUB = "/api/hub/talent";

export function NewClientForm() {
  const empty = { company: "", contact_name: "", email: "", phone: "", website: "", industry: "", city: "", notes: "" };
  const [f, setF] = useState(empty);
  const { busy, msg, act } = useAct(HUB);
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-4">
      {(Object.keys(empty) as (keyof typeof empty)[]).filter((k) => k !== "notes").map((k) => <input key={k} className="input" placeholder={{ company: "Company *", contact_name: "Contact name *", email: "Email *", phone: "Phone", website: "Website", industry: "Industry", city: "City" }[k]} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />)}
      <button className="btn-primary" disabled={busy || !f.company || !f.contact_name || !/@/.test(f.email)} onClick={async () => { const r = await act({ action: "client", ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v || (["company", "contact_name", "email"].includes(k) ? v : null)])) }, "Client added."); if (r.ok) setF(empty); }}>Add client</button>
      {msg && <span className="text-ink-soft sm:col-span-4">{msg}</span>}
    </div>
  );
}

export function NewSearchForm({ clients }: { clients: { id: string; company: string }[] }) {
  const empty = { client_id: clients[0]?.id ?? "", title: "", location: "", workplace: "onsite", salary_min: "", salary_max: "", openings: "1", description: "", must_haves: "", type: "contingency", exclusive: false };
  const [f, setF] = useState(empty);
  const { busy, msg, act } = useAct(HUB);
  if (!clients.length) return <p className="text-sm text-ink-soft">Add a client first.</p>;
  return (
    <div className="space-y-2 text-sm">
      <div className="grid gap-2 sm:grid-cols-4">
        <select className="input" value={f.client_id} onChange={(e) => setF({ ...f, client_id: e.target.value })}>{clients.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}</select>
        <input className="input sm:col-span-2" placeholder="Job title *" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="contingency">Contingency</option><option value="retained">Retained</option></select>
        <input className="input" placeholder="Location" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
        <select className="input" value={f.workplace} onChange={(e) => setF({ ...f, workplace: e.target.value })}><option value="onsite">On site</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option></select>
        <input className="input" placeholder="Salary from" inputMode="numeric" value={f.salary_min} onChange={(e) => setF({ ...f, salary_min: e.target.value })} />
        <input className="input" placeholder="Salary to" inputMode="numeric" value={f.salary_max} onChange={(e) => setF({ ...f, salary_max: e.target.value })} />
      </div>
      <textarea className="input min-h-20" placeholder="About the role" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      <textarea className="input min-h-16" placeholder="Must-haves" value={f.must_haves} onChange={(e) => setF({ ...f, must_haves: e.target.value })} />
      <button className="btn-primary" disabled={busy || !f.title || !f.client_id} onClick={async () => { const r = await act({ action: "search", client_id: f.client_id, title: f.title, location: f.location || null, workplace: f.workplace, salary_min: numOrNull(f.salary_min), salary_max: numOrNull(f.salary_max), openings: Math.max(1, Number(f.openings) || 1), description: f.description || null, must_haves: f.must_haves || null, type: f.type, exclusive: f.exclusive }, "Search created (New request). Open it to assign recruiters and open it."); if (r.ok) setF(empty); }}>Create search</button>
      {msg && <span className="ml-2 text-ink-soft">{msg}</span>}
    </div>
  );
}

export function SearchControls({ s }: { s: { id: string; status: string; type: string; fee_pct: number; recruiter_pct: number; minimum_fee: number; estimated_salary: number | null; fair_override: string | null; fair_flags: { issue: string; fix: string; match: string }[]; signed: boolean } }) {
  const { busy, msg, act } = useAct(HUB);
  const [t, setT] = useState({ fee_pct: String(s.fee_pct), recruiter_pct: String(s.recruiter_pct), minimum_fee: String(s.minimum_fee), estimated_salary: s.estimated_salary ? String(s.estimated_salary) : "", fair_override: s.fair_override ?? "" });
  return (
    <div className="space-y-3 text-sm">
      {s.fair_flags.length > 0 && (
        <div className="rounded-xl bg-amber-50 p-3">
          <b>Fair-hiring check:</b>
          <ul className="mt-1 list-disc pl-5">{s.fair_flags.map((f) => <li key={f.issue}><b>{f.issue}</b> (“{f.match}”): {f.fix}</li>)}</ul>
          <p className="mt-1 text-xs">Fix the job order with the client, or record why it&apos;s a lawful, real requirement:</p>
          <input className="input mt-1" placeholder="Why this is a lawful requirement (leave blank to fix instead)" value={t.fair_override} onChange={(e) => setT({ ...t, fair_override: e.target.value })} />
        </div>
      )}
      {!s.signed && <p className="rounded-xl bg-amber-50 p-3">The client hasn&apos;t accepted the agreement yet. Send them the review link — it asks them to accept first.</p>}
      <div className="grid gap-2 sm:grid-cols-4">
        <div><label className="text-xs text-ink-soft">Fee % of salary</label><input className="input" value={t.fee_pct} onChange={(e) => setT({ ...t, fee_pct: e.target.value })} /></div>
        <div><label className="text-xs text-ink-soft">Recruiter % of salary</label><input className="input" value={t.recruiter_pct} onChange={(e) => setT({ ...t, recruiter_pct: e.target.value })} /></div>
        <div><label className="text-xs text-ink-soft">Minimum fee $</label><input className="input" value={t.minimum_fee} onChange={(e) => setT({ ...t, minimum_fee: e.target.value })} /></div>
        {s.type === "retained" && <div><label className="text-xs text-ink-soft">Estimated salary (retainer)</label><input className="input" value={t.estimated_salary} onChange={(e) => setT({ ...t, estimated_salary: e.target.value })} /></div>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-ghost" disabled={busy} onClick={() => act({ action: "search_update", search_id: s.id, fee_pct: Number(t.fee_pct), recruiter_pct: Number(t.recruiter_pct), minimum_fee: Number(t.minimum_fee) || 0, ...(s.type === "retained" ? { estimated_salary: numOrNull(t.estimated_salary) } : {}), fair_override: t.fair_override || null }, "Saved.")}>Save terms</button>
        {s.status !== "open" && <button className="btn-primary" disabled={busy} onClick={() => act({ action: "search_update", search_id: s.id, status: "open", fair_override: t.fair_override || null }, "Search is open.")}>Open the search</button>}
        {s.status === "open" && <button className="btn-ghost" disabled={busy} onClick={() => act({ action: "search_update", search_id: s.id, status: "on_hold" }, "On hold.")}>Put on hold</button>}
        {!["cancelled", "filled"].includes(s.status) && <button className="btn-ghost" disabled={busy} onClick={() => { if (confirm("Cancel this search?")) void act({ action: "search_update", search_id: s.id, status: "cancelled" }, "Cancelled."); }}>Cancel search</button>}
        <button className="btn-ghost" disabled={busy} onClick={() => act({ action: "send_review_link", search_id: s.id }, "Review link emailed to the client.")}>Email the client their review link</button>
      </div>
      {msg && <p className="text-ink-soft">{msg}</p>}
    </div>
  );
}

export function RecruiterPicker({ searchId, assigned, recruiters }: { searchId: string; assigned: { id: string; business_name: string; role: string }[]; recruiters: { id: string; business_name: string }[] }) {
  const { busy, msg, act } = useAct(HUB);
  const [pick, setPick] = useState("");
  const [role, setRole] = useState("support");
  return (
    <div className="space-y-2 text-sm">
      {assigned.length ? <ul>{assigned.map((a) => <li key={a.id} className="flex items-center gap-2">{a.business_name} <span className="text-xs text-ink-soft">({a.role})</span><button className="text-xs text-ink-soft underline" onClick={() => act({ action: "unassign", search_id: searchId, contractor_id: a.id })}>remove</button></li>)}</ul> : <p className="text-ink-soft">No recruiters yet.</p>}
      {recruiters.length ? (
        <div className="flex flex-wrap gap-2">
          <select className="input w-auto" value={pick} onChange={(e) => setPick(e.target.value)}><option value="">Add a recruiter…</option>{recruiters.filter((r) => !assigned.some((a) => a.id === r.id)).map((r) => <option key={r.id} value={r.id}>{r.business_name}</option>)}</select>
          <select className="input w-auto" value={role} onChange={(e) => setRole(e.target.value)}><option value="lead">Lead</option><option value="support">Support</option></select>
          <button className="btn-ghost" disabled={busy || !pick} onClick={() => act({ action: "assign", search_id: searchId, contractor_id: pick, role }, "Assigned and emailed.")}>Assign</button>
        </div>
      ) : <p className="text-xs text-ink-soft">No approved recruiters yet. Recruiters apply as pros with the trade “Recruiter (Handled Talent)”.</p>}
      {msg && <p className="text-ink-soft">{msg}</p>}
    </div>
  );
}

export function PlacementActions({ p }: { p: { id: string; status: string; start_date: string; payment_url: string | null } }) {
  const { busy, msg, act } = useAct(HUB);
  const [exit, setExit] = useState({ date: "", reason: "resigned", remedy: "replacement" });
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1 text-xs">
      <div className="flex flex-wrap gap-2">
        {p.status === "pending_start" && <button className="btn-ghost py-1 text-xs" disabled={busy} onClick={() => act({ action: "invoice", placement_id: p.id }, "Invoiced.")}>Invoice now</button>}
        {p.payment_url && <a className="text-brand underline" href={p.payment_url} target="_blank" rel="noreferrer">payment link</a>}
        {["paid", "invoiced"].includes(p.status) && <button className="text-ink-soft underline" onClick={() => setShow(!show)}>Hire left early…</button>}
      </div>
      {show && (
        <div className="flex flex-wrap gap-1">
          <input type="date" className="input w-auto py-1 text-xs" value={exit.date} onChange={(e) => setExit({ ...exit, date: e.target.value })} />
          <select className="input w-auto py-1 text-xs" value={exit.reason} onChange={(e) => setExit({ ...exit, reason: e.target.value })}><option value="resigned">Resigned</option><option value="terminated_performance">Let go: performance</option><option value="terminated_cause">Let go: cause</option><option value="laid_off">Laid off</option><option value="position_eliminated">Role eliminated</option><option value="other">Other</option></select>
          <select className="input w-auto py-1 text-xs" value={exit.remedy} onChange={(e) => setExit({ ...exit, remedy: e.target.value })}><option value="replacement">Replacement search</option><option value="refund">Prorated refund</option></select>
          <button className="btn-ghost py-1 text-xs" disabled={busy || !exit.date} onClick={async () => { const r = await act({ action: "exit", placement_id: p.id, exit_date: exit.date, reason: exit.reason, remedy: exit.remedy }); if (r.ok) alert(String(r.why ?? "Recorded")); }}>Record</button>
        </div>
      )}
      {msg && <span className="text-ink-soft">{msg}</span>}
    </div>
  );
}

export function RetainerInvoiceButton({ id }: { id: string }) {
  const { busy, msg, act } = useAct(HUB);
  return <span><button className="btn-ghost py-1 text-xs" disabled={busy} onClick={() => act({ action: "invoice", retainer_id: id }, "Invoiced.")}>Invoice now</button>{msg && <span className="ml-1 text-xs text-ink-soft">{msg}</span>}</span>;
}
