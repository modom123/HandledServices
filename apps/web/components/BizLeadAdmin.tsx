/*
 * FILE    : apps/web/components/BizLeadAdmin.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-04_1934 UTC
 * PURPOSE : Hub → Business leads controls: engine settings (on/off, volume, segments, pilot offer),
 *           run now, and lead outcomes from calls.
 * UPDATED : 2026-10-05_0130 UTC — "Add a business from a job posting" (job-posting letter by email, or print it).
 * UPDATED : 2026-10-05_2134 UTC — partner status options (no automated email).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BIZ_SEGMENTS, BUSINESS_TERMS, type BizSegment } from "@handled/core";

async function post(body: unknown) {
  const r = await fetch("/api/hub/biz-leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return r.ok ? null : String(j.error ?? "Failed");
}

const JOB_SITES = ["Indeed", "ZipRecruiter", "LinkedIn", "Craigslist", "Facebook", "Glassdoor", "Company website", "Other"];

/** A business that posted a job for work we do: they get the job-posting letter (email now, or print it). */
export function JobPostLeadForm({ sendingReady }: { sendingReady: boolean }) {
  const router = useRouter();
  const empty = { business_name: "", contact_name: "", email: "", phone: "", city: "", job_title: "", posting_source: "Indeed", posting_url: "", segment: "property_manager" as BizSegment };
  const [f, setF] = useState(empty);
  const [sendNow, setSendNow] = useState(sendingReady);
  const [msg, setMsg] = useState<{ text: string; id?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const field = (k: keyof typeof empty, label: string, cls = "") => <input className={`input ${cls}`} placeholder={label} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />;
  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-2 sm:grid-cols-3">
        {field("business_name", "Business name *")}
        {field("job_title", "Job they posted * (e.g. Maintenance Technician)")}
        <select className="input" value={f.segment} onChange={(e) => setF({ ...f, segment: e.target.value as BizSegment })}>{(Object.keys(BIZ_SEGMENTS) as BizSegment[]).map((k) => <option key={k} value={k}>{BIZ_SEGMENTS[k].label}</option>)}</select>
        {field("contact_name", "Contact name (if listed)")}
        {field("email", "Business email (from their website)")}
        {field("phone", "Phone")}
        {field("city", "City")}
        <select className="input" value={f.posting_source} onChange={(e) => setF({ ...f, posting_source: e.target.value })}>{JOB_SITES.map((x) => <option key={x}>{x}</option>)}</select>
        {field("posting_url", "Link to the posting")}
      </div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={sendNow} disabled={!sendingReady} onChange={(e) => setSendNow(e.target.checked)} /> Start the email sequence now{!sendingReady && " (sending isn’t set up yet — it waits in the queue)"}</label>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" disabled={busy || f.business_name.trim().length < 2 || f.job_title.trim().length < 2} onClick={async () => {
          setBusy(true); setMsg(null);
          const r = await fetch("/api/hub/biz-leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add_job_post", ...f, send_now: sendNow }) });
          const j = await r.json().catch(() => ({}));
          setBusy(false);
          if (r.ok && j.ok) { setMsg({ text: j.sent ? "Added and emailed." : f.email ? "Added to the email queue." : "Added to the call list (no email).", id: j.id }); setF(empty); router.refresh(); }
          else setMsg({ text: String(j.error ?? "Failed"), id: j.id });
        }}>Add lead</button>
        {msg && <span className="text-ink-soft">{msg.text} {msg.id && <a className="font-semibold text-brand underline" href={`/hub/biz-leads/${msg.id}/letter`}>Open the letter →</a>}</span>}
      </div>
      <p className="text-xs text-ink-soft">Find postings by hand on the job sites (they don’t allow scraping), then get the business email from the company’s own website. Use the email only for this one business offer; anyone who unsubscribes is never emailed again.</p>
    </div>
  );
}

export function BizLeadSettingsForm({ s }: { s: { enabled: boolean; discover_per_day: number; emails_per_day: number; segments: BizSegment[]; pilot_pct: number; pilot_jobs: number } }) {
  const router = useRouter();
  const [f, setF] = useState(s);
  const [msg, setMsg] = useState("");
  return (
    <div className="space-y-3 text-sm">
      <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} /> Engine on (weekdays, with the pro lead engine)</label>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-1">Searches/day <input className="input w-16" inputMode="numeric" value={f.discover_per_day} onChange={(e) => setF({ ...f, discover_per_day: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></label>
        <label className="flex items-center gap-1">New sequences/day <input className="input w-16" inputMode="numeric" value={f.emails_per_day} onChange={(e) => setF({ ...f, emails_per_day: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></label>
        <label className="flex items-center gap-1">Pilot <input className="input w-14" inputMode="numeric" value={f.pilot_pct} onChange={(e) => setF({ ...f, pilot_pct: Math.min(BUSINESS_TERMS.maxPilotPct, Number(e.target.value.replace(/\D/g, "")) || 0) })} />% off the first <input className="input w-12" inputMode="numeric" value={f.pilot_jobs} onChange={(e) => setF({ ...f, pilot_jobs: Math.min(BUSINESS_TERMS.maxPilotJobs, Number(e.target.value.replace(/\D/g, "")) || 0) })} /> jobs</label>
      </div>
      <div className="flex flex-wrap gap-3">{(Object.keys(BIZ_SEGMENTS) as BizSegment[]).map((k) => (
        <label key={k} className="flex items-center gap-1"><input type="checkbox" checked={f.segments.includes(k)} onChange={(e) => setF({ ...f, segments: e.target.checked ? [...f.segments, k] : f.segments.filter((x) => x !== k) })} />{BIZ_SEGMENTS[k].label}</label>
      ))}</div>
      <div className="flex gap-2">
        <button className="btn-primary" onClick={async () => { const e = await post({ action: "settings", ...f }); setMsg(e ?? "Saved"); router.refresh(); }}>Save</button>
        <button className="btn-ghost" onClick={async () => { setMsg("Running…"); const e = await post({ action: "run" }); setMsg(e ?? "Done"); router.refresh(); }}>Run now</button>
        {msg && <span className="self-center text-ink-soft">{msg}</span>}
      </div>
    </div>
  );
}

export function BizLeadStatus({ id, partner = false }: { id: string; partner?: boolean }) {
  const router = useRouter();
  return (
    <select className="input w-40 text-xs" defaultValue="" onChange={async (e) => { if (!e.target.value) return; await post({ action: "status", id, status: e.target.value }); router.refresh(); }}>
      {partner
        ? <><option value="">Mark…</option><option value="replied">Talking / interested</option><option value="call">To contact</option><option value="not_interested">Not interested</option><option value="do_not_contact">Do not contact</option></>
        : <><option value="">Mark…</option><option value="replied">Talking / interested</option><option value="queued">Email them</option><option value="call">Call list</option><option value="not_interested">Not interested</option><option value="do_not_contact">Do not contact</option></>}
    </select>
  );
}
