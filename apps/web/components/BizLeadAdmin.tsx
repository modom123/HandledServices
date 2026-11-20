/*
 * FILE    : apps/web/components/BizLeadAdmin.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-04_1934 UTC
 * PURPOSE : Hub → Business leads controls: engine settings (on/off, volume, segments, pilot offer),
 *           run now, and lead outcomes from calls.
 * UPDATED : 2026-10-05_0130 UTC — "Add a business from a job posting" (job-posting letter by email, or print it).
 * UPDATED : 2026-10-05_2134 UTC — partner status options (no automated email).
 * UPDATED : 2026-10-07_2030 UTC — job-posting searches/day setting and "Find job postings now" (Adzuna, Michigan + Washington).
 * UPDATED : 2026-10-19_2230 UTC — "Sync Instantly campaign" (leads uploaded in Instantly → this list).
 * UPDATED : 2026-11-11_0100 UTC — settings: send from our outreach domain or Instantly, rest days, rounds; Refresh list now; Check outreach mailbox.
 * UPDATED : 2026-11-17_2335 UTC — AI email outreach from handledsvc.net: "AI personalizes each email" setting; OutreachReplyBox (their
 *           reply, the AI's draft answer, edit and send from the outreach mailbox in their thread); EmailPreview (what the
 *           AI writer would send this lead, nothing sent).
 * UPDATED : 2026-11-20_0040 UTC — the mailbox check shows which mail servers it used.
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

export function BizLeadSettingsForm({ s }: { s: { enabled: boolean; discover_per_day: number; emails_per_day: number; segments: BizSegment[]; pilot_pct: number; pilot_jobs: number; job_posts_per_day: number; sender: "instantly" | "own"; rest_days: number; max_rounds: number; ai_personalize: boolean } }) {
  const router = useRouter();
  const [f, setF] = useState(s);
  const [msg, setMsg] = useState("");
  return (
    <div className="space-y-3 text-sm">
      <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} /> Engine on (weekdays, with the pro lead engine)</label>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-1">Searches/day <input className="input w-16" inputMode="numeric" value={f.discover_per_day} onChange={(e) => setF({ ...f, discover_per_day: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></label>
        <label className="flex items-center gap-1" title="Job-board searches each weekday (Michigan + Washington, via Adzuna)">Job-posting searches/day <input className="input w-16" inputMode="numeric" value={f.job_posts_per_day ?? 6} onChange={(e) => setF({ ...f, job_posts_per_day: Math.min(40, Number(e.target.value.replace(/\D/g, "")) || 0) })} /></label>
        <label className="flex items-center gap-1">New sequences/day <input className="input w-16" inputMode="numeric" value={f.emails_per_day} onChange={(e) => setF({ ...f, emails_per_day: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></label>
        <label className="flex items-center gap-1">Pilot <input className="input w-14" inputMode="numeric" value={f.pilot_pct} onChange={(e) => setF({ ...f, pilot_pct: Math.min(BUSINESS_TERMS.maxPilotPct, Number(e.target.value.replace(/\D/g, "")) || 0) })} />% off the first <input className="input w-12" inputMode="numeric" value={f.pilot_jobs} onChange={(e) => setF({ ...f, pilot_jobs: Math.min(BUSINESS_TERMS.maxPilotJobs, Number(e.target.value.replace(/\D/g, "")) || 0) })} /> jobs</label>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-1">Send from
          <select className="input w-auto" value={f.sender ?? "instantly"} onChange={(e) => setF({ ...f, sender: e.target.value as "instantly" | "own" })}>
            <option value="own">Our outreach domain: handledsvc.net</option>
            <option value="instantly">Instantly</option>
          </select></label>
        <label className="flex items-center gap-1" title="After a round of emails with no answer, a lead rests this long before one re-engagement round">Rest <input className="input w-16" inputMode="numeric" value={f.rest_days ?? 90} onChange={(e) => setF({ ...f, rest_days: Math.min(365, Number(e.target.value.replace(/\D/g, "")) || 0) })} /> days between rounds</label>
        <label className="flex items-center gap-1" title="The AI writer rewrites each email for that business (their type, city, the job they posted). It can't change the offer, quote prices or add links; anything that breaks the rules sends the plain template."><input type="checkbox" checked={f.ai_personalize ?? true} onChange={(e) => setF({ ...f, ai_personalize: e.target.checked })} /> AI personalizes each email</label>
        <label className="flex items-center gap-1" title="Rounds of email per lead before it retires for a year (2 = the first sequence + one re-engagement)">Rounds <input className="input w-12" inputMode="numeric" value={f.max_rounds ?? 2} onChange={(e) => setF({ ...f, max_rounds: Math.max(1, Math.min(4, Number(e.target.value.replace(/\D/g, "")) || 1)) })} /></label>
      </div>
      <div className="flex flex-wrap gap-3">{(Object.keys(BIZ_SEGMENTS) as BizSegment[]).map((k) => (
        <label key={k} className="flex items-center gap-1"><input type="checkbox" checked={f.segments.includes(k)} onChange={(e) => setF({ ...f, segments: e.target.checked ? [...f.segments, k] : f.segments.filter((x) => x !== k) })} />{BIZ_SEGMENTS[k].label}</label>
      ))}</div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={async () => { const e = await post({ action: "settings", ...f }); setMsg(e ?? "Saved"); router.refresh(); }}>Save</button>
        <button className="btn-ghost" onClick={async () => { setMsg("Running…"); const e = await post({ action: "run" }); setMsg(e ?? "Done"); router.refresh(); }}>Run now</button>
        <button className="btn-ghost" onClick={async () => {
          setMsg("Pulling leads from the Instantly campaign…");
          const r = await fetch("/api/hub/biz-leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sync_instantly" }) });
          const j = await r.json().catch(() => ({}));
          setMsg(r.ok ? `Instantly: ${j.seen} leads checked, ${j.added} new in the CRM, ${j.updated} updated` : String(j.error ?? "Failed")); router.refresh();
        }}>Sync Instantly campaign</button>
        <button className="btn-ghost" onClick={async () => {
          setMsg("Refreshing the list…");
          const r = await fetch("/api/hub/biz-leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "refresh" }) });
          const j = await r.json().catch(() => ({}));
          setMsg(r.ok ? `Refreshed: ${j.rested} resting, ${j.woke} woken, ${j.warm} to the call list, ${j.retired} retired, ${j.duplicates} duplicates, ${j.revived} back` : String(j.error ?? "Failed")); router.refresh();
        }}>Refresh list now</button>
        <button className="btn-ghost" onClick={async () => {
          setMsg("Checking the outreach mailbox…");
          const r = await fetch("/api/hub/biz-leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify_outreach" }) });
          const j = await r.json().catch(() => ({}));
          setMsg(r.ok ? `Outreach mailbox ${j.dns?.domain ?? "(not set)"}${j.login?.servers ? ` (${j.login.servers})` : ""}: sending ${j.login?.smtp}, inbox ${j.login?.imap} · SPF ${j.dns?.spf ? "✓" : "✗"} DKIM ${j.dns?.dkim ? "✓" : "✗"} DMARC ${j.dns?.dmarc ? "✓" : "✗"}${j.dns?.notes?.length ? ` — ${j.dns.notes.join(" ")}` : ""}` : String(j.error ?? "Failed"));
        }}>Check outreach mailbox</button>
        <button className="btn-ghost" onClick={async () => { setMsg("Searching job boards…"); const e = await post({ action: "job_posts" }); setMsg(e ?? "Done — new job-posting leads are in the list"); router.refresh(); }}>Find job postings now</button>
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

/** A business answered our outreach: their words, the AI's draft answer, edit and send from handledsvc.net in their thread. */
export function OutreachReplyBox({ id, replyText, replyAt, draft, intent, answeredAt, canSend }: { id: string; replyText: string; replyAt: string | null; draft: string | null; intent: string | null; answeredAt: string | null; canSend: boolean }) {
  const router = useRouter();
  const [text, setText] = useState(draft ?? "");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const act = async (body: Record<string, unknown>) => {
    setBusy(true); setMsg("");
    const r = await fetch("/api/hub/biz-leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    return { ok: r.ok && j.ok !== false, j };
  };
  const answered = answeredAt && replyAt && new Date(answeredAt) >= new Date(replyAt);
  return (
    <div className="space-y-3 text-sm">
      <div className="text-xs text-ink-soft">{replyAt ? new Date(replyAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}{intent ? ` · AI read: ${intent.replace(/_/g, " ")}` : ""}{answered ? " · answered ✓" : ""}</div>
      <blockquote className="whitespace-pre-wrap rounded-lg border-l-4 border-brand bg-paper p-3">{replyText}</blockquote>
      <label className="block font-semibold">Your answer {draft ? <span className="font-normal text-ink-soft">(drafted by the AI — check every word)</span> : null}
        <textarea className="input mt-1 h-44" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write your answer, or press Draft with AI." />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" disabled={busy || !canSend || text.trim().length < 5} onClick={async () => {
          if (!confirm("Send this answer from the outreach mailbox (handledsvc.net)?")) return;
          const r = await act({ action: "send_reply", id, text });
          setMsg(r.ok ? "Sent ✓ (in their thread, saved to the mailbox's Sent folder)" : String(r.j.error ?? "Couldn't send")); if (r.ok) router.refresh();
        }}>Send from handledsvc.net</button>
        <button className="btn-ghost" disabled={busy} onClick={async () => { const r = await act({ action: "redraft_reply", id }); if (r.ok) setText(String(r.j.draft ?? "")); setMsg(r.ok ? "New draft ready — check it before sending" : String(r.j.error ?? "Failed")); }}>✨ Draft with AI</button>
        {msg && <span className="text-ink-soft">{msg}</span>}
      </div>
      {!canSend && <p className="text-xs text-amber-800">The outreach mailbox isn’t connected, so answer from webmail for now (Hub → Setup shows what’s missing).</p>}
      <p className="text-xs text-ink-soft">Never put prices in an email: send the booking link or offer a free walkthrough. Our name and address are added under your answer.</p>
    </div>
  );
}

/** What the engine would send this lead next (AI-personalized when on). Nothing is sent. */
export function EmailPreview({ id }: { id: string }) {
  const [step, setStep] = useState(0);
  const [m, setM] = useState<{ subject: string; text: string; ai: boolean } | null>(null);
  const [msg, setMsg] = useState("");
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-auto" value={step} onChange={(e) => setStep(Number(e.target.value))}>{[0, 1, 2].map((i) => <option key={i} value={i}>Email {i + 1}</option>)}</select>
        <button className="btn-ghost" onClick={async () => {
          setMsg("Writing…"); setM(null);
          const r = await fetch("/api/hub/biz-leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "preview_email", id, step }) });
          const j = await r.json().catch(() => ({}));
          if (r.ok && j.ok) { setM({ subject: j.subject, text: j.text, ai: j.ai }); setMsg(""); } else setMsg(String(j.error ?? "Failed"));
        }}>Preview</button>
        {msg && <span className="text-ink-soft">{msg}</span>}
      </div>
      {m && <div className="rounded-lg border border-line p-3"><div className="text-xs text-ink-soft">{m.ai ? "AI-personalized (passed the checks)" : "Plain template (AI off, or its version broke a rule)"} · each preview is written fresh</div><div className="mt-1 font-semibold">{m.subject}</div><pre className="mt-2 whitespace-pre-wrap font-sans">{m.text}</pre></div>}
    </div>
  );
}
