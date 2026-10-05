/*
 * FILE    : apps/web/components/BidWorkspace.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_1954 UTC
 * PURPOSE : Hub → Bids controls (client): start a bid, the bid's details, go / no-go, documents (upload straight to
 *           private storage; the AI reads the solicitation into the matrix), the compliance matrix, pricing (live math
 *           from core priceBid — the number on screen is the number we bid), pros' written prices, review sign-off,
 *           submit (gate enforced on the server too), the result, and price benchmarks.
 * UPDATED : 2026-10-05_2043 UTC — archive: document versions (upload a new version, earlier ones kept), submission history with
 *           "view exactly what was sent", revise & resubmit, start a new bid from this one; solicitation type.
 */
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BID_SOURCES, DEFAULT_ASSUMPTIONS, GO_NO_GO, MIN_MARGIN_PCT, REQ_KIND_LABEL, RESUBMIT_REASONS, REVIEW_CHECKS, SOLICITATION_TYPES, priceBid,
  type BidAssumptions, type GoAnswer, type ReqKind, type ResubmitReason,
} from "@handled/core";
import { browserClient } from "@/lib/supabase/browser";

async function post(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; [k: string]: unknown }> {
  const r = await fetch("/api/hub/bids", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ...j, ok: r.ok && j.ok !== false, error: j.error };
}
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

function useAct() {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const act = async (label: string, body: Record<string, unknown>, done?: (r: Record<string, unknown>) => string | void) => {
    setBusy(label); setMsg("");
    const r = await post(body);
    setBusy("");
    if (!r.ok) setMsg(String(r.error ?? "Failed"));
    else { const m = done?.(r); if (m) setMsg(m); router.refresh(); }
    return r;
  };
  return { busy, msg, setMsg, act };
}

// ───────────────────────────── start ─────────────────────────────

export function NewBidForm() {
  const router = useRouter();
  const [f, setF] = useState({ title: "", agency: "", source: "city", solicitation_type: "rfq", solicitation_number: "", link: "", due_at: "" });
  const [err, setErr] = useState("");
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-3">
      <input className="input sm:col-span-2" placeholder="Title (e.g. Ground maintenance — Bridging Neighborhoods vacant homes) *" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <select className="input" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>{Object.entries(BID_SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <input className="input" placeholder="Agency (e.g. City of Detroit OCP / HHFS)" value={f.agency} onChange={(e) => setF({ ...f, agency: e.target.value })} />
      <select className="input" value={f.solicitation_type} onChange={(e) => setF({ ...f, solicitation_type: e.target.value })}>{Object.entries(SOLICITATION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <input className="input" placeholder="Solicitation / RFQ number" value={f.solicitation_number} onChange={(e) => setF({ ...f, solicitation_number: e.target.value })} />
      <div><label className="text-xs text-ink-soft">Due (local time)</label><input className="input" type="datetime-local" value={f.due_at} onChange={(e) => setF({ ...f, due_at: e.target.value })} /></div>
      <input className="input sm:col-span-2" placeholder="Link to the posting" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} />
      <div className="flex items-center gap-2">
        <button className="btn-primary" disabled={f.title.trim().length < 3} onClick={async () => {
          setErr("");
          const r = await post({ action: "create", ...f, agency: f.agency || null, solicitation_number: f.solicitation_number || null, link: f.link || null, due_at: fromLocal(f.due_at) });
          if (r.ok && r.id) router.push(`/hub/bids/${r.id}`); else setErr(String(r.error ?? "Failed"));
        }}>Start bid</button>
        {err && <span className="text-rose-700">{err}</span>}
      </div>
    </div>
  );
}

/** From a SAM.gov notice (Hub → Gov contracts → notice). */
export function StartBidButton({ noticeId, bidId }: { noticeId: string; bidId: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (bidId) return <a href={`/hub/bids/${bidId}`} className="btn-primary">Open the bid workspace →</a>;
  return <button className="btn-primary" disabled={busy} onClick={async () => { setBusy(true); const r = await post({ action: "create", notice_id: noticeId }); setBusy(false); if (r.ok && r.id) router.push(`/hub/bids/${r.id}`); }}>{busy ? "Starting…" : "Start a bid"}</button>;
}

export function BenchmarkForm() {
  const router = useRouter();
  const empty = { item: "", unit: "", price: "", agency: "", source: "", award_date: "", note: "" };
  const [f, setF] = useState(empty);
  const [msg, setMsg] = useState("");
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-7">
      <input className="input sm:col-span-2" placeholder="Item (e.g. Vacant lot mowing)" value={f.item} onChange={(e) => setF({ ...f, item: e.target.value })} />
      <input className="input" placeholder="Unit (visit)" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />
      <input className="input" placeholder="Price $" inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value.replace(/[^\d.]/g, "") })} />
      <input className="input" placeholder="Agency" value={f.agency} onChange={(e) => setF({ ...f, agency: e.target.value })} />
      <input className="input" placeholder="Source (bid tab, award)" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} />
      <button className="btn-ghost" disabled={!f.item || !f.unit || !(Number(f.price) > 0)} onClick={async () => {
        const r = await post({ action: "benchmark", item: f.item, unit: f.unit, price: Number(f.price), agency: f.agency || null, source: f.source || null, award_date: null, note: null });
        setMsg(r.ok ? "Added." : String(r.error)); if (r.ok) { setF(empty); router.refresh(); }
      }}>Add benchmark</button>
      {msg && <span className="text-ink-soft">{msg}</span>}
    </div>
  );
}

// ───────────────────────────── types from the page ─────────────────────────────

export interface WsBid {
  id: string; title: string; agency: string | null; source: string; solicitation_number: string | null; link: string | null; due_at: string | null; questions_due_at: string | null;
  submit_method: string | null; term_years: number | null; status: string; go: Record<string, GoAnswer>; no_bid_reason: string | null; assumptions: Partial<BidAssumptions>;
  margin_override: boolean; review: Record<string, boolean>; reviewer: string | null; reviewed_at: string | null; owner: string | null; notes: string | null;
  submitted_at: string | null; award_amount: number | null; winning_price: number | null; winner: string | null; result_note: string | null;
  ai_summary: { summary: string; red_flags: string[] } | null;
  solicitation_type: string; revision: number; reopened_at: string | null; reopen_reason: string | null; reopen_note: string | null; previous_bid_id: string | null;
}
export interface WsReq { id: string; kind: ReqKind; text: string; source_ref: string | null; response_ref: string | null; required: boolean; done: boolean; done_by: string | null; origin: string }
export interface WsLine { id: string; item: string; unit: string; qty: number; years: number; pro_unit_cost: number | null; materials_unit: number; benchmark: number | null; slug: string | null }
export interface WsQuote { id: string; contractor_id: string; status: "asked" | "committed" | "declined"; prices: Record<string, number>; capacity: string | null; small_business: boolean | null; note: string | null; answered_at: string | null; contractor: { business_name: string; email: string | null; phone: string | null } | null }
export interface WsDoc { id: string; kind: string; name: string; size: number | null; ai_read_at: string | null; created_at: string; version: number; superseded_at: string | null; superseded_by: string | null; note: string | null }
export interface WsGate { ready: boolean; canMarkSubmitted: boolean; missing: string[]; warnings: string[] }

// ───────────────────────────── details ─────────────────────────────

export function BidFields({ b }: { b: WsBid }) {
  const { busy, msg, act } = useAct();
  const [f, setF] = useState({ title: b.title, agency: b.agency ?? "", source: b.source, solicitation_type: b.solicitation_type, solicitation_number: b.solicitation_number ?? "", link: b.link ?? "", due_at: toLocal(b.due_at), questions_due_at: toLocal(b.questions_due_at), submit_method: b.submit_method ?? "", term_years: b.term_years ? String(b.term_years) : "", notes: b.notes ?? "" });
  const inp = (k: keyof typeof f, label: string, type = "text") => <div><label className="text-xs text-ink-soft">{label}</label><input className="input" type={type} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>;
  return (
    <div className="space-y-2 text-sm">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="sm:col-span-2">{inp("title", "Title")}</div>
        <div><label className="text-xs text-ink-soft">Source</label><select className="input" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>{Object.entries(BID_SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label className="text-xs text-ink-soft">Type</label><select className="input" value={f.solicitation_type} onChange={(e) => setF({ ...f, solicitation_type: e.target.value })}>{Object.entries(SOLICITATION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        {inp("agency", "Agency")}{inp("solicitation_number", "Solicitation / RFQ no.")}{inp("term_years", "Term (years)", "number")}
        {inp("due_at", "Response due (local)", "datetime-local")}{inp("questions_due_at", "Questions due (local)", "datetime-local")}{inp("link", "Posting link")}
      </div>
      <div><label className="text-xs text-ink-soft">How to submit (portal, email, copies, format)</label><textarea className="input min-h-16" value={f.submit_method} onChange={(e) => setF({ ...f, submit_method: e.target.value })} /></div>
      <div><label className="text-xs text-ink-soft">Notes</label><textarea className="input min-h-16" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      <button className="btn-ghost" disabled={Boolean(busy)} onClick={() => act("save", { action: "fields", bid_id: b.id, title: f.title, agency: f.agency || null, source: f.source, solicitation_type: f.solicitation_type, solicitation_number: f.solicitation_number || null, link: f.link || null, due_at: fromLocal(f.due_at), questions_due_at: fromLocal(f.questions_due_at), submit_method: f.submit_method || null, term_years: f.term_years ? Number(f.term_years) : null, notes: f.notes || null }, () => "Saved.")}>Save details</button>
      {msg && <span className="ml-2 text-ink-soft">{msg}</span>}
    </div>
  );
}

// ───────────────────────────── 1. go / no-go ─────────────────────────────

export function GoNoGo({ b }: { b: WsBid }) {
  const { busy, msg, act } = useAct();
  const [a, setA] = useState<Record<string, GoAnswer>>(b.go ?? {});
  const [reason, setReason] = useState(b.no_bid_reason ?? "");
  const anyNo = GO_NO_GO.some((g) => g.mustPass && a[g.id] === "no");
  return (
    <div className="space-y-3 text-sm">
      {GO_NO_GO.map((g) => (
        <div key={g.id} className="flex flex-wrap items-start justify-between gap-2 border-b border-line pb-2">
          <div className="max-w-xl"><div className="font-semibold">{g.q}{!g.mustPass && <span className="ml-1 text-xs font-normal text-ink-soft">(judgment call)</span>}</div><div className="text-xs text-ink-soft">{g.help}</div></div>
          <div className="flex gap-1">{(["yes", "unsure", "no"] as GoAnswer[]).map((v) => (
            <button key={v} onClick={() => setA({ ...a, [g.id]: v })} className={`rounded-full border px-3 py-1 text-xs capitalize ${a[g.id] === v ? (v === "yes" ? "border-green-600 bg-green-50 font-semibold" : v === "no" ? "border-rose-600 bg-rose-50 font-semibold" : "border-amber-500 bg-amber-50 font-semibold") : "border-line"}`}>{v}</button>
          ))}</div>
        </div>
      ))}
      {anyNo && <div><label className="text-xs text-ink-soft">Why we're not bidding (helps next time)</label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></div>}
      <button className="btn-primary" disabled={Boolean(busy)} onClick={() => act("go", { action: "go", bid_id: b.id, answers: a, reason: reason || null }, () => (anyNo ? "Saved as no bid." : "Saved."))}>Save decision</button>
      {msg && <span className="ml-2 text-ink-soft">{msg}</span>}
    </div>
  );
}

// ───────────────────────────── 2. documents ─────────────────────────────

const DOC_KIND_LABEL: Record<string, string> = { rfq: "Solicitation / RFQ", addendum: "Addendum", price_form: "Price form", draft: "Our draft response", confirmation: "Submission confirmation", other: "Other" };

export function BidDocuments({ bidId, docs, aiReady, locked }: { bidId: string; docs: WsDoc[]; aiReady: boolean; locked: string[] }) {
  const { busy, msg, setMsg, act } = useAct();
  const router = useRouter();
  const [kind, setKind] = useState("rfq");
  const [replacing, setReplacing] = useState<WsDoc | null>(null);
  const [note, setNote] = useState("");
  const current = docs.filter((d) => !d.superseded_at);
  const older = (d: WsDoc): WsDoc[] => { const prev = docs.find((x) => x.superseded_by === d.id); return prev ? [prev, ...older(prev)] : []; };
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setMsg("");
    for (const file of Array.from(replacing ? [files[0]] : files)) {
      if (file.size > 50 * 1024 * 1024) { setMsg(`${file.name} is over 50 MB`); continue; }
      setMsg(`Uploading ${file.name}…`);
      const u = await post({ action: "upload_url", bid_id: bidId, name: file.name });
      if (!u.ok) { setMsg(String(u.error)); return; }
      const { error } = await browserClient().storage.from("bids").uploadToSignedUrl(String(u.path), String(u.token), file, { contentType: file.type || "application/octet-stream" });
      if (error) { setMsg(error.message); return; }
      const r = await post({ action: "add_doc", bid_id: bidId, kind: replacing?.kind ?? kind, name: file.name, path: u.path, size: file.size, replaces: replacing?.id ?? null, note: note || null });
      if (!r.ok) { setMsg(String(r.error)); return; }
    }
    setMsg(replacing ? `Saved as version ${replacing.version + 1} — the earlier version is kept.` : "Uploaded."); setReplacing(null); setNote(""); router.refresh();
  }
  const open = async (id: string) => { const r = await post({ action: "doc_link", bid_id: bidId, doc_id: id }); if (r.ok && r.url) window.open(String(r.url), "_blank"); };
  return (
    <div className="space-y-3 text-sm">
      {current.length > 0 && (
        <ul className="divide-y divide-line">{current.map((d) => {
          const prev = older(d);
          return (
            <li key={d.id} className="py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span><b>{DOC_KIND_LABEL[d.kind] ?? d.kind}:</b> {d.name} <span className="text-xs text-ink-soft">v{d.version}{d.size ? ` · ${Math.round(d.size / 1024)} KB` : ""} · {new Date(d.created_at).toLocaleDateString("en-US")}{d.ai_read_at ? " · read by AI" : ""}{locked.includes(d.id) ? " · in a submission" : ""}</span>{d.note && <span className="block text-xs italic text-ink-soft">{d.note}</span>}</span>
                <span className="flex gap-2">
                  <button className="text-xs text-brand underline" onClick={() => void open(d.id)}>Open</button>
                  <button className="text-xs text-brand underline" onClick={() => { setReplacing(d); setNote(""); }}>Upload new version</button>
                  {!locked.includes(d.id) && <button className="text-xs text-rose-700 underline" onClick={() => { if (confirm(`Delete ${d.name}? (Only for files uploaded by mistake.)`)) void act("del", { action: "delete_doc", bid_id: bidId, doc_id: d.id }); }}>Delete</button>}
                </span>
              </div>
              {prev.length > 0 && <details className="mt-1 text-xs"><summary className="cursor-pointer text-ink-soft">Earlier versions ({prev.length})</summary><ul className="mt-1 space-y-0.5 pl-3">{prev.map((o) => <li key={o.id}>v{o.version} · {o.name} · {new Date(o.created_at).toLocaleDateString("en-US")}{o.note ? ` · ${o.note}` : ""} · <button className="text-brand underline" onClick={() => void open(o.id)}>open</button></li>)}</ul></details>}
            </li>
          );
        })}</ul>
      )}
      {replacing ? (
        <div className="rounded-xl border border-brand p-3">
          <div className="font-semibold">New version of {replacing.name} (now v{replacing.version})</div>
          <input className="input mt-2" placeholder="What changed (e.g. Addendum 2 prices, corrected Form B signature)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="mt-2 flex flex-wrap items-center gap-2"><input type="file" onChange={(e) => void upload(e.target.files)} className="text-xs" /><button className="text-xs underline" onClick={() => setReplacing(null)}>cancel</button></div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select className="input w-auto" value={kind} onChange={(e) => setKind(e.target.value)}>{Object.entries(DOC_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <input type="file" multiple onChange={(e) => void upload(e.target.files)} className="text-xs" />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <button className="btn-primary" disabled={Boolean(busy) || !aiReady || !current.some((d) => ["rfq", "addendum", "price_form"].includes(d.kind))} onClick={() => act("read", { action: "read", bid_id: bidId }, (r) => `Read: ${r.added ?? 0} requirement${r.added === 1 ? "" : "s"} added${r.lines ? `, ${r.lines} price lines` : ""}. Check every item against the documents.`)}>
          {busy === "read" ? "Reading the solicitation… (a minute or two)" : "✨ Read the solicitation into the matrix"}
        </button>
        {!aiReady && <span className="text-xs text-ink-soft">Set ANTHROPIC_API_KEY for the AI reading.</span>}
        <span className="text-xs text-ink-soft">Every file is kept: a new version never overwrites the old one, and files sent in a submission can&apos;t be deleted.</span>
      </div>
      {msg && <p className="text-ink-soft">{msg}</p>}
    </div>
  );
}

// ───────────────────────────── archive: submissions, revise & resubmit, copy ─────────────────────────────

export interface WsSubmission { id: string; number: number; reason: string; change_note: string | null; submitted_at: string; submitted_by: string; our_price: number | null }

export function SubmissionHistory({ b, subs }: { b: WsBid; subs: WsSubmission[] }) {
  const { busy, msg, act } = useAct();
  const router = useRouter();
  const [reason, setReason] = useState<ResubmitReason>("correction");
  const [note, setNote] = useState("");
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-3 text-sm">
      {subs.length ? (
        <ul className="divide-y divide-line">{subs.map((s, i) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span><b>Version {s.number}</b> · {new Date(s.submitted_at).toLocaleString("en-US", { timeZone: "America/Detroit", dateStyle: "medium", timeStyle: "short" })} · {s.submitted_by}{s.our_price ? ` · ${usd(Number(s.our_price))}` : ""}{i > 0 && subs[i - 1].our_price && s.our_price ? <span className={Number(s.our_price) < Number(subs[i - 1].our_price) ? "text-green-700" : "text-rose-700"}> ({Number(s.our_price) >= Number(subs[i - 1].our_price) ? "+" : ""}{usd(Number(s.our_price) - Number(subs[i - 1].our_price))})</span> : null}
              <span className="block text-xs text-ink-soft">{s.number === 1 ? "Initial submission" : RESUBMIT_REASONS[s.reason as ResubmitReason] ?? s.reason}{s.change_note ? ` — ${s.change_note}` : ""}</span></span>
            <a href={`/hub/bids/${b.id}/v/${s.number}`} className="text-xs font-semibold text-brand underline">View exactly what was sent</a>
          </li>
        ))}</ul>
      ) : <p className="text-ink-soft">Nothing submitted yet. Each submission is saved here as a numbered version you can always go back to.</p>}
      {b.status === "review" && b.reopened_at && <p className="rounded-xl bg-amber-50 p-3">Being revised for version {(subs.at(-1)?.number ?? 0) + 1}: {RESUBMIT_REASONS[b.reopen_reason as ResubmitReason] ?? b.reopen_reason}{b.reopen_note ? ` — ${b.reopen_note}` : ""}. Make the changes, sign off the review again, submit, and upload the new confirmation.</p>}
      <div className="flex flex-wrap gap-2">
        {b.status === "submitted" && <button className="btn-ghost" onClick={() => setShow(!show)}>Revise &amp; resubmit…</button>}
        <button className="btn-ghost" disabled={Boolean(busy)} onClick={async () => { if (!confirm("Start a new bid for the next cycle, copying this one's details, matrix (unchecked) and pricing?")) return; const r = await post({ action: "copy", bid_id: b.id }); if (r.ok && r.id) router.push(`/hub/bids/${r.id}`); }}>Start a new bid from this one</button>
      </div>
      {show && (
        <div className="space-y-2 rounded-xl border border-line p-3">
          <select className="input" value={reason} onChange={(e) => setReason(e.target.value as ResubmitReason)}>{Object.entries(RESUBMIT_REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <textarea className="input min-h-16" placeholder="What's changing and why (kept with the new version)" value={note} onChange={(e) => setNote(e.target.value)} />
          <p className="text-xs text-ink-soft">Version {subs.at(-1)?.number ?? 1} stays saved exactly as sent. If the agency set a new deadline (e.g. for a best and final offer), update the due date in Details.</p>
          <button className="btn-primary" disabled={Boolean(busy) || note.trim().length < 5} onClick={async () => { const r = await act("reopen", { action: "reopen", bid_id: b.id, reason, note }, () => "Re-opened for changes."); if (r.ok) setShow(false); }}>Re-open for changes</button>
        </div>
      )}
      {msg && <p className="text-ink-soft">{msg}</p>}
    </div>
  );
}

// ───────────────────────────── 3. compliance matrix ─────────────────────────────

export function ComplianceMatrix({ bidId, reqs }: { bidId: string; reqs: WsReq[] }) {
  const { msg, act } = useAct();
  const [add, setAdd] = useState<{ kind: ReqKind; text: string; source_ref: string }>({ kind: "requirement", text: "", source_ref: "" });
  const kinds = Object.keys(REQ_KIND_LABEL) as ReqKind[];
  const open = reqs.filter((r) => r.required && !r.done).length;
  return (
    <div className="space-y-4 text-sm">
      <p className="text-ink-soft">{reqs.length} items · <b>{open} required still open</b>. Check an item off only after you&apos;ve seen it in the documents and know where our response answers it.</p>
      {kinds.filter((k) => reqs.some((r) => r.kind === k)).map((k) => (
        <div key={k}>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">{REQ_KIND_LABEL[k]}</div>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {reqs.filter((r) => r.kind === k).map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-3 p-2">
                <input type="checkbox" className="mt-1" checked={r.done} onChange={(e) => void act("req", { action: "req", bid_id: bidId, id: r.id, done: e.target.checked })} />
                <div className="min-w-0 flex-1">
                  <div className={r.done ? "text-ink-soft line-through" : ""}>{r.text}{!r.required && <span className="ml-1 text-xs text-ink-soft">(scored / optional)</span>}</div>
                  <div className="text-xs text-ink-soft">{r.source_ref ? `Where: ${r.source_ref} · ` : ""}{r.origin === "ai" ? "found by AI" : r.origin === "standard" ? "standard item" : "added by hand"}{r.done_by ? ` · checked by ${r.done_by}` : ""}</div>
                  <input className="input mt-1 py-1 text-xs" placeholder="Answered in (e.g. Section 4, Form B, Attachment 3)" defaultValue={r.response_ref ?? ""} onBlur={(e) => { if ((e.target.value || null) !== r.response_ref) void act("ref", { action: "req", bid_id: bidId, id: r.id, response_ref: e.target.value || null }); }} />
                </div>
                <button className="text-xs text-ink-soft underline" onClick={() => { if (confirm("Remove this item?")) void act("del", { action: "delete_req", bid_id: bidId, id: r.id }); }}>remove</button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="grid gap-2 border-t border-line pt-3 sm:grid-cols-6">
        <select className="input" value={add.kind} onChange={(e) => setAdd({ ...add, kind: e.target.value as ReqKind })}>{kinds.map((k) => <option key={k} value={k}>{REQ_KIND_LABEL[k]}</option>)}</select>
        <input className="input sm:col-span-3" placeholder="Requirement, form, date or question" value={add.text} onChange={(e) => setAdd({ ...add, text: e.target.value })} />
        <input className="input" placeholder="Where (section/page)" value={add.source_ref} onChange={(e) => setAdd({ ...add, source_ref: e.target.value })} />
        <button className="btn-ghost" disabled={add.text.trim().length < 2} onClick={async () => { const r = await act("add", { action: "req", bid_id: bidId, kind: add.kind, text: add.text, source_ref: add.source_ref || null }); if (r.ok) setAdd({ ...add, text: "", source_ref: "" }); }}>Add item</button>
      </div>
      {msg && <p className="text-ink-soft">{msg}</p>}
    </div>
  );
}

// ───────────────────────────── 4. pricing ─────────────────────────────

const ASSUMPTION_FIELDS: [keyof BidAssumptions, string, string][] = [
  ["supervisionPct", "Supervision %", "scheduling, quality checks"], ["insurancePct", "Insurance %", "extra coverage for this contract"], ["adminPct", "Admin %", "reporting, invoicing"],
  ["contingencyPct", "Contingency %", "weather, re-dos, cost creep"], ["bondPct", "Bonds %", "0 if none"], ["paymentDays", "Days to get paid", "after we pay the pro"],
  ["costOfMoneyPct", "Cost of money %/yr", "line of credit"], ["marginPct", "Margin % of price", `floor ${MIN_MARGIN_PCT}%`], ["roundTo", "Round up to $", "1 = whole dollars"],
];

type EditLine = { id?: string; key: string; item: string; unit: string; qty: string; years: string; pro_unit_cost: string; materials_unit: string; benchmark: string; slug: string | null };
const toEdit = (l: WsLine): EditLine => ({ id: l.id, key: l.id, item: l.item, unit: l.unit, qty: String(l.qty ?? 0), years: String(l.years ?? 1), pro_unit_cost: l.pro_unit_cost === null ? "" : String(l.pro_unit_cost), materials_unit: String(l.materials_unit ?? 0), benchmark: l.benchmark === null ? "" : String(l.benchmark), slug: l.slug });
const num = (s: string) => (s.trim() === "" ? null : Number(s));

export function BidPricing({ b, lines, best }: { b: WsBid; lines: WsLine[]; best: Record<string, { best: { price: number } | null; count: number; backup: boolean }> }) {
  const { busy, msg, act } = useAct();
  const [rows, setRows] = useState<EditLine[]>(lines.map(toEdit));
  const [removed, setRemoved] = useState<string[]>([]);
  const [a, setA] = useState<BidAssumptions>({ ...DEFAULT_ASSUMPTIONS, ...b.assumptions });
  const [override, setOverride] = useState(b.margin_override);
  const priced = useMemo(() => priceBid(rows.map((r) => ({ id: r.key, item: r.item, unit: r.unit, qty: Number(r.qty) || 0, years: Number(r.years) || 0, pro_unit_cost: num(r.pro_unit_cost), materials_unit: Number(r.materials_unit) || 0, benchmark: num(r.benchmark) })), a), [rows, a]);
  const set = (i: number, k: keyof EditLine, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: k === "item" || k === "unit" ? v : v.replace(/[^\d.]/g, "") } : r)));
  const term = b.term_years ? String(b.term_years) : "1";
  return (
    <div className="space-y-4 text-sm">
      <div className="grid gap-2 sm:grid-cols-9">
        {ASSUMPTION_FIELDS.map(([k, label, hint]) => (
          <div key={k}><label className="block text-xs text-ink-soft" title={hint}>{label}</label><input className="input py-1" inputMode="decimal" value={String(a[k])} onChange={(e) => setA({ ...a, [k]: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} /></div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-xs">
          <thead className="bg-paper text-left uppercase tracking-wide text-ink-soft">
            <tr><th className="p-2">Item (as on the price form)</th><th className="p-2">Unit</th><th className="p-2">Qty / yr</th><th className="p-2">Years</th><th className="p-2">Pro cost / unit</th><th className="p-2">Materials / unit</th><th className="p-2">Last award</th><th className="p-2 text-right">Bid / unit</th><th className="p-2 text-right">Margin</th><th className="p-2 text-right">Contract total</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const p = priced.lines[i];
              const q = r.id ? best[r.id] : undefined;
              return (
                <tr key={r.key} className="border-t border-line align-top">
                  <td className="p-1"><input className="input py-1 text-xs" value={r.item} onChange={(e) => set(i, "item", e.target.value)} />{p.flags.length > 0 && <div className="mt-1 text-amber-800">{p.flags.map((f) => <div key={f}>⚠ {f}</div>)}</div>}</td>
                  <td className="p-1"><input className="input w-20 py-1 text-xs" value={r.unit} onChange={(e) => set(i, "unit", e.target.value)} /></td>
                  <td className="p-1"><input className="input w-20 py-1 text-xs" inputMode="decimal" value={r.qty} onChange={(e) => set(i, "qty", e.target.value)} /></td>
                  <td className="p-1"><input className="input w-14 py-1 text-xs" inputMode="decimal" value={r.years} onChange={(e) => set(i, "years", e.target.value)} /></td>
                  <td className="p-1"><input className="input w-20 py-1 text-xs" inputMode="decimal" value={r.pro_unit_cost} onChange={(e) => set(i, "pro_unit_cost", e.target.value)} placeholder="$" />
                    {q && q.count > 0 && <div className="mt-1 text-ink-soft">{q.count} pro{q.count > 1 ? "s" : ""} · best {usd(q.best!.price)}{!q.backup && <span className="text-amber-800"> · no backup</span>}</div>}</td>
                  <td className="p-1"><input className="input w-16 py-1 text-xs" inputMode="decimal" value={r.materials_unit} onChange={(e) => set(i, "materials_unit", e.target.value)} /></td>
                  <td className="p-1"><input className="input w-20 py-1 text-xs" inputMode="decimal" value={r.benchmark} onChange={(e) => set(i, "benchmark", e.target.value)} placeholder="$" /></td>
                  <td className="p-2 text-right font-semibold">{p.unitPrice ? usd(p.unitPrice) : "—"}</td>
                  <td className={`p-2 text-right ${p.unitPrice && p.marginPct < MIN_MARGIN_PCT ? "text-rose-700" : ""}`}>{p.unitPrice ? `${p.marginPct}%` : "—"}</td>
                  <td className="p-2 text-right">{p.totalPrice ? usd(p.totalPrice) : "—"}</td>
                  <td className="p-1"><button className="text-ink-soft underline" onClick={() => { if (r.id) setRemoved([...removed, r.id]); setRows(rows.filter((_, j) => j !== i)); }}>✕</button></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-line bg-paper font-semibold">
            <tr><td className="p-2" colSpan={7}>Per year {usd(priced.totals.yearPrice)} · cost {usd(priced.totals.totalCost)} · profit {usd(priced.totals.totalProfit)} ({priced.totals.marginPct}%) · cash to carry ≈ {usd(priced.totals.cashGap)}</td><td className="p-2 text-right" colSpan={3}>Bid total {usd(priced.totals.totalPrice)}</td><td></td></tr>
          </tfoot>
        </table>
      </div>
      {priced.warnings.length > 0 && <ul className="text-amber-800">{priced.warnings.map((w) => <li key={w}>⚠ {w}</li>)}</ul>}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-ghost" onClick={() => setRows([...rows, { key: `new-${Date.now()}`, item: "", unit: "each", qty: "0", years: term, pro_unit_cost: "", materials_unit: "0", benchmark: "", slug: null }])}>+ Add line</button>
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} /> Owner override: allow a line under the {MIN_MARGIN_PCT}% margin floor</label>
        <button className="btn-primary" disabled={Boolean(busy) || rows.some((r) => !r.item.trim() || !r.unit.trim())} onClick={() => act("save", {
          action: "lines", bid_id: b.id, removed, margin_override: override, assumptions: a,
          lines: rows.map((r) => ({ id: r.id, item: r.item.trim(), unit: r.unit.trim(), qty: Number(r.qty) || 0, years: Number(r.years) || 0, pro_unit_cost: num(r.pro_unit_cost), materials_unit: Number(r.materials_unit) || 0, benchmark: num(r.benchmark), slug: r.slug })),
        }, () => { setRemoved([]); return "Saved. (Saving pricing clears the review sign-off — review again before submitting.)"; })}>Save pricing</button>
        {msg && <span className="text-ink-soft">{msg}</span>}
      </div>
      <p className="text-xs text-ink-soft">How a price is built: pro cost + materials, plus supervision, insurance, admin, contingency and bonds, plus the cost of waiting {a.paymentDays} days to be paid — then margin on the price, rounded up. Copy “Bid / unit” onto the agency&apos;s own price form, in its units.</p>
    </div>
  );
}

// ───────────────────────────── 5. pros' written prices ─────────────────────────────

type Cand = { id: string; business_name: string; email: string | null; rating: number | null; jobs_completed: number | null };

export function BidProQuotes({ bidId, quotes, lines }: { bidId: string; quotes: WsQuote[]; lines: WsLine[] }) {
  const { busy, msg, act } = useAct();
  const [cands, setCands] = useState<Cand[] | null>(null);
  const [pick, setPick] = useState<string[]>([]);
  const asked = new Set(quotes.map((q) => q.contractor_id));
  return (
    <div className="space-y-3 text-sm">
      {quotes.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-xs">
            <thead className="bg-paper text-left uppercase tracking-wide text-ink-soft"><tr><th className="p-2">Pro</th><th className="p-2">Answer</th>{lines.map((l) => <th key={l.id} className="p-2">{l.item.slice(0, 24)}</th>)}<th className="p-2">Capacity</th><th className="p-2">Small biz</th></tr></thead>
            <tbody>{quotes.map((q) => (
              <tr key={q.id} className="border-t border-line align-top">
                <td className="p-2"><b>{q.contractor?.business_name ?? "—"}</b><div className="text-ink-soft">{q.contractor?.email ?? ""}</div>{q.note && <div className="mt-1 italic">“{q.note}”</div>}</td>
                <td className="p-2"><select className="input w-auto py-1 text-xs" value={q.status} onChange={(e) => void act("qs", { action: "quote_status", bid_id: bidId, quote_id: q.id, status: e.target.value })}><option value="asked">Asked</option><option value="committed">Committed</option><option value="declined">Declined</option></select></td>
                {lines.map((l) => <td key={l.id} className="p-2">{q.prices?.[l.id] ? usd(Number(q.prices[l.id])) : "—"}</td>)}
                <td className="p-2">{q.capacity ?? "—"}</td>
                <td className="p-2">{q.small_business === null ? "?" : q.small_business ? "Yes" : "No"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-ghost" disabled={Boolean(busy)} onClick={async () => { const r = await post({ action: "candidates", bid_id: bidId }); if (r.ok) { const p = (r.pros as Cand[]) ?? []; setCands(p); setPick(p.filter((c) => !asked.has(c.id) && c.email).slice(0, 8).map((c) => c.id)); } }}>Find pros to ask</button>
        <button className="btn-primary" disabled={Boolean(busy) || !quotes.some((q) => q.status === "committed")} onClick={() => act("use", { action: "use_quotes", bid_id: bidId }, (r) => `${r.updated ?? 0} line(s) set to the lowest committed price.`)}>Use the lowest committed prices</button>
        {msg && <span className="text-ink-soft">{msg}</span>}
      </div>
      {cands && (
        <div className="rounded-xl border border-line p-3">
          {cands.length === 0 ? <p className="text-ink-soft">No approved pros match these lines yet (lines need a service, or recruit first).</p> : (
            <>
              <div className="grid gap-1 sm:grid-cols-2">{cands.map((c) => (
                <label key={c.id} className="flex items-center gap-2"><input type="checkbox" disabled={!c.email} checked={pick.includes(c.id)} onChange={() => setPick(pick.includes(c.id) ? pick.filter((x) => x !== c.id) : [...pick, c.id])} /> {c.business_name} <span className="text-xs text-ink-soft">{c.rating ? `${c.rating}★` : "new"} · {c.jobs_completed ?? 0} jobs{asked.has(c.id) ? " · already asked" : ""}</span></label>
              ))}</div>
              <button className="btn-primary mt-2" disabled={Boolean(busy) || !pick.length || !lines.length} onClick={() => { if (confirm(`Email ${pick.length} pro(s) a private link to quote this bid?`)) void act("ask", { action: "ask_pros", bid_id: bidId, contractor_ids: pick }, (r) => `Sent ${r.sent ?? 0} price request(s).`).then(() => setCands(null)); }}>Email {pick.length} price request{pick.length === 1 ? "" : "s"}</button>
              {!lines.length && <p className="mt-1 text-xs text-ink-soft">Add the price lines first: pros quote each line.</p>}
            </>
          )}
        </div>
      )}
      <p className="text-xs text-ink-soft">Each pro gets a private link to give their own price per line, their capacity and small-business status, and to confirm their prices hold for 120 days and the first contract year. It&apos;s a quote, not an offer of work.</p>
    </div>
  );
}

// ───────────────────────────── 6. review & submit ─────────────────────────────

export function ReviewSubmit({ b, gate, hasConfirmation }: { b: WsBid; gate: WsGate; hasConfirmation: boolean }) {
  const { busy, msg, act } = useAct();
  const [checks, setChecks] = useState<Record<string, boolean>>(b.review ?? {});
  const all = REVIEW_CHECKS.every((c) => checks[c.id]);
  const submitted = ["submitted", "won", "lost"].includes(b.status);
  const resubmitting = Boolean(b.reopened_at);
  return (
    <div className="space-y-4 text-sm">
      {!submitted && (
        <>
          <div>
            <div className="font-semibold">Review — ideally by someone who didn&apos;t write the bid</div>
            <ul className="mt-2 space-y-1">{REVIEW_CHECKS.map((c) => <li key={c.id}><label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={Boolean(checks[c.id])} onChange={(e) => setChecks({ ...checks, [c.id]: e.target.checked })} /> {c.text}</label></li>)}</ul>
            <button className="btn-ghost mt-2" disabled={Boolean(busy)} onClick={() => act("review", { action: "review", bid_id: b.id, checks }, () => (all ? "Signed off." : "Saved — finish every check to sign off."))}>{all ? "Sign off the review" : "Save review"}</button>
            {b.reviewer && <span className="ml-2 text-xs text-ink-soft">Signed off by {b.reviewer}{b.reviewed_at ? ` · ${new Date(b.reviewed_at).toLocaleString("en-US", { timeZone: "America/Detroit" })}` : ""}</span>}
          </div>
          <div className={`rounded-xl p-3 ${gate.ready ? "bg-green-50" : "bg-amber-50"}`}>
            <div className="font-semibold">{gate.canMarkSubmitted ? "✓ Ready — mark it submitted" : gate.ready ? "✓ Ready to submit. Submit it the way the instructions say, then upload the confirmation (Documents → Submission confirmation)." : "Not ready to submit yet"}</div>
            {gate.missing.length > 0 && <ul className="mt-1 list-disc pl-5">{gate.missing.map((m) => <li key={m}>{m}</li>)}</ul>}
            {gate.warnings.length > 0 && <ul className="mt-1 text-amber-900">{gate.warnings.map((m) => <li key={m}>⚠ {m}</li>)}</ul>}
            <button className="btn-primary mt-2" disabled={Boolean(busy) || !gate.canMarkSubmitted || !hasConfirmation} onClick={() => act("submit", { action: "submit", bid_id: b.id }, () => "Marked submitted — saved as a new version.")}>{resubmitting ? "Mark resubmitted (new version)" : "Mark submitted"}</button>
          </div>
        </>
      )}
      {submitted && <p className="rounded-xl bg-green-50 p-3">Submitted {b.submitted_at ? new Date(b.submitted_at).toLocaleString("en-US", { timeZone: "America/Detroit" }) : ""}. Record the result when the award is announced, and ask for a debrief either way.</p>}
      {msg && <p className="text-ink-soft">{msg}</p>}
    </div>
  );
}

export function BidResult({ b, lines }: { b: WsBid; lines: WsLine[] }) {
  const { busy, msg, act } = useAct();
  const [f, setF] = useState({ result: b.status === "won" ? "won" : "lost", award_amount: b.award_amount ? String(b.award_amount) : "", winning_price: b.winning_price ? String(b.winning_price) : "", winner: b.winner ?? "", note: b.result_note ?? "" });
  const [units, setUnits] = useState<Record<string, string>>({});
  return (
    <div className="space-y-2 text-sm">
      <div className="grid gap-2 sm:grid-cols-4">
        <select className="input" value={f.result} onChange={(e) => setF({ ...f, result: e.target.value })}><option value="won">We won</option><option value="lost">We lost</option></select>
        <input className="input" placeholder="Winner" value={f.winner} onChange={(e) => setF({ ...f, winner: e.target.value })} />
        <input className="input" placeholder="Winning total $" inputMode="decimal" value={f.winning_price} onChange={(e) => setF({ ...f, winning_price: e.target.value.replace(/[^\d.]/g, "") })} />
        <input className="input" placeholder="Award amount $ (if different)" inputMode="decimal" value={f.award_amount} onChange={(e) => setF({ ...f, award_amount: e.target.value.replace(/[^\d.]/g, "") })} />
      </div>
      {lines.length > 0 && (
        <div>
          <div className="text-xs text-ink-soft">Winning unit prices from the bid tabulation (saved as benchmarks for the next bid):</div>
          <div className="grid gap-1 sm:grid-cols-3">{lines.map((l) => <label key={l.id} className="flex items-center gap-1 text-xs"><span className="w-40 truncate">{l.item}</span>$<input className="input w-24 py-1 text-xs" inputMode="decimal" value={units[l.id] ?? ""} onChange={(e) => setUnits({ ...units, [l.id]: e.target.value.replace(/[^\d.]/g, "") })} /></label>)}</div>
        </div>
      )}
      <textarea className="input min-h-16" placeholder="Debrief notes: why we won or lost, what to change next time" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      <button className="btn-primary" disabled={Boolean(busy)} onClick={() => act("result", {
        action: "result", bid_id: b.id, result: f.result, winner: f.winner || null, note: f.note || null,
        winning_price: f.winning_price ? Number(f.winning_price) : null, award_amount: f.award_amount ? Number(f.award_amount) : null,
        unit_awards: Object.entries(units).filter(([, v]) => Number(v) > 0).map(([line_id, v]) => ({ line_id, price: Number(v) })),
      }, () => "Result saved.")}>Save result</button>
      {msg && <span className="ml-2 text-ink-soft">{msg}</span>}
    </div>
  );
}

export function BidStatusButtons({ b }: { b: WsBid }) {
  const { busy, act } = useAct();
  if (["submitted", "won", "lost"].includes(b.status)) return null;
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {b.status !== "no_bid" && <button className="btn-ghost py-1 text-xs" disabled={Boolean(busy)} onClick={() => { const reason = prompt("Why aren't we bidding? (helps next time)"); if (reason !== null) void act("nb", { action: "status", bid_id: b.id, status: "no_bid", reason }); }}>No bid</button>}
      {["no_bid", "cancelled"].includes(b.status) && <button className="btn-ghost py-1 text-xs" disabled={Boolean(busy)} onClick={() => act("re", { action: "status", bid_id: b.id, status: "draft" })}>Reopen</button>}
      {b.status !== "cancelled" && <button className="btn-ghost py-1 text-xs" disabled={Boolean(busy)} onClick={() => { if (confirm("Mark this solicitation cancelled by the agency?")) void act("cx", { action: "status", bid_id: b.id, status: "cancelled" }); }}>Agency cancelled</button>}
    </div>
  );
}

/** Open a stored bid file (signed link). */
export function DocOpen({ bidId, docId, label }: { bidId: string; docId: string; label: string }) {
  return <button className="text-brand underline" onClick={async () => { const r = await post({ action: "doc_link", bid_id: bidId, doc_id: docId }); if (r.ok && r.url) window.open(String(r.url), "_blank"); }}>{label}</button>;
}

export function PrintButton() {
  return <button className="btn-ghost print:hidden" onClick={() => window.print()}>Print / save as PDF</button>;
}
