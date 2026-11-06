/*
 * FILE    : apps/web/components/ProposalWriter.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-06_0400 UTC
 * PURPOSE : Hub → Bids → a bid → Proposal (client). Pick who we bid as, have the AI build the outline from the solicitation,
 *           draft every section (one at a time, so long proposals don't time out), fill the [[NEEDS]] markers, edit,
 *           approve each section, run the AI evaluator review, then print the proposal. Also: pull SAM.gov attachments
 *           into the bid, and the bidding-profile editor (Hub → Bids → Bidding profiles).
 */
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PROPOSAL_STATUS_LABEL, needsInput, wordCount, wordsToPages, type ProposalStatus } from "@handled/core";

async function post(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; [k: string]: unknown }> {
  const r = await fetch("/api/hub/bids", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ...j, ok: r.ok && j.ok !== false, error: j.error };
}

export interface WsSection { id: string; title: string; guidance: string | null; page_limit: number | null; requirement_ids: string[]; content: string; status: ProposalStatus; ai_at: string | null; approved_by: string | null }
export interface WsProfile { id: string; name: string | null; is_default: boolean }
export interface WsReview {
  at: string; verdict: string; strengths: string[];
  weaknesses: { section: string; issue: string; fix: string }[];
  missing_requirements: { requirement_number: number; issue: string }[];
  risky_claims: { section: string; claim: string; why: string }[];
  format_issues: string[];
}

const STATUS_STYLE: Record<ProposalStatus, string> = { outline: "bg-slate-100 text-slate-700", draft: "bg-sky-100 text-sky-800", edited: "bg-amber-100 text-amber-800", approved: "bg-green-100 text-green-800" };

/** Pull the notice's attachments from SAM.gov into the bid's documents. */
export function SamImportButton({ bidId }: { bidId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <button className="btn-ghost" disabled={busy} onClick={async () => {
        setBusy(true); setMsg("");
        const r = await post({ action: "sam_import", bid_id: bidId });
        setBusy(false);
        const failed = (r.failed as string[] | undefined) ?? [];
        setMsg(r.ok ? `${r.added} file${r.added === 1 ? "" : "s"} added${r.skipped ? `, ${r.skipped} already here` : ""}${failed.length ? ` · ${failed.length} failed: ${failed[0]}` : ""}` : String(r.error ?? "Failed"));
        router.refresh();
      }}>{busy ? "Downloading from SAM.gov…" : "⬇ Pull the attachments from SAM.gov"}</button>
      {msg && <span className="text-ink-soft">{msg}</span>}
    </div>
  );
}

export function ProposalWriter({ bidId, sections, profiles, profileId, format, review, reqs, aiReady, closed }: {
  bidId: string; sections: WsSection[]; profiles: WsProfile[]; profileId: string | null; format: string | null; review: WsReview | null;
  reqs: { id: string; text: string; required: boolean }[]; aiReady: boolean; closed: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [progress, setProgress] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const reqNo = useMemo(() => Object.fromEntries(reqs.map((r, i) => [r.id, i + 1])), [reqs]);
  const assigned = new Set(sections.flatMap((s) => s.requirement_ids));
  const unassigned = reqs.filter((r) => r.required && !assigned.has(r.id)).length;
  const markers = sections.reduce((n, s) => n + needsInput(s.content).length, 0);
  const approved = sections.filter((s) => s.status === "approved").length;

  const act = async (label: string, body: Record<string, unknown>, done?: (r: Record<string, unknown>) => string | void) => {
    setBusy(label); setMsg("");
    const r = await post({ bid_id: bidId, ...body });
    setBusy("");
    if (!r.ok) setMsg(String(r.error ?? "Failed")); else { const m = done?.(r); if (m) setMsg(m); }
    router.refresh();
    return r;
  };

  const outline = async () => {
    const hasText = sections.some((s) => s.content.trim());
    if (hasText && !confirm("Rebuild the outline? The written sections will be deleted.")) return;
    await act("outline", { action: "outline", replace: hasText }, (r) => r.fallback ? `Standard ${r.sections}-section outline made (the AI couldn't read an outline from the documents — edit it to match the solicitation's instructions).` : `${r.sections} sections, in the solicitation's order.`);
  };

  const draftAll = async () => {
    const todo = sections.filter((s) => s.status !== "approved" && !s.content.trim());
    if (!todo.length) { setMsg("Every section already has text — use “Rewrite” on a section to redo it."); return; }
    setBusy("all"); setMsg("");
    let failed = 0;
    for (const [i, s] of todo.entries()) {
      setProgress(`Writing ${i + 1} of ${todo.length}: ${s.title}…`);
      const r = await post({ action: "draft_section", bid_id: bidId, section_id: s.id });
      if (!r.ok) failed++;
      router.refresh();
    }
    setProgress(""); setBusy("");
    setMsg(failed ? `${todo.length - failed} written, ${failed} failed — try those again.` : `All ${todo.length} sections drafted. Fill the yellow [[NEEDS]] items, edit, and approve each one.`);
  };

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-ink-soft">Bidding as</span>
          <select className="input mt-1 w-auto" value={profileId ?? ""} disabled={closed} onChange={(e) => act("profile", { action: "set_profile", profile_id: e.target.value || null })}>
            {!profiles.length && <option value="">No profile yet</option>}
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}{p.is_default ? " (default)" : ""}</option>)}
          </select>
        </label>
        <a href="/hub/bids/profiles" className="text-xs text-brand underline">Edit bidding profiles (UEI, past performance, people) →</a>
        <a href={`/hub/bids/${bidId}/proposal`} target="_blank" rel="noreferrer" className="btn-ghost ml-auto">🖨 Print / save the proposal as PDF</a>
      </div>
      <p className="text-xs text-ink-soft">The AI writes only from the solicitation and the bidding profile. Anything it doesn't know becomes a yellow <mark className="bg-yellow-200 px-1">[[NEEDS: …]]</mark> to fill in. It never makes up past performance, people, certifications or prices. Every section needs a person's approval before the bid can be submitted.</p>

      {!closed && (
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-primary" disabled={Boolean(busy) || !aiReady} onClick={outline}>{busy === "outline" ? "Reading the instructions…" : sections.length ? "↻ Rebuild the outline" : "✨ 1. Build the outline with AI"}</button>
          <button className="btn-primary" disabled={Boolean(busy) || !aiReady || !sections.length} onClick={draftAll}>{busy === "all" ? "Writing…" : "✨ 2. Draft all empty sections"}</button>
          <button className="btn-ghost" disabled={Boolean(busy) || !aiReady || !sections.some((s) => s.content.trim())} onClick={() => act("review", { action: "review_proposal" }, () => "Review ready below.")}>{busy === "review" ? "Evaluating like the agency…" : "🔍 3. AI evaluator review"}</button>
          {!aiReady && <span className="text-xs text-ink-soft">Set ANTHROPIC_API_KEY to use the AI.</span>}
        </div>
      )}
      {progress && <p className="font-semibold text-brand">{progress}</p>}
      {msg && <p className="text-ink-soft">{msg}</p>}

      {sections.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="rounded-full bg-paper px-3 py-1">{approved}/{sections.length} approved</span>
          <span className={`rounded-full px-3 py-1 ${markers ? "bg-yellow-100 text-yellow-900" : "bg-paper"}`}>{markers} [[NEEDS]] to fill</span>
          {unassigned > 0 && <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">{unassigned} required compliance item{unassigned > 1 ? "s" : ""} not assigned to a section</span>}
        </div>
      )}
      {format && <div className="rounded-lg bg-paper p-3 text-xs"><b>Format rules from the solicitation:</b> {format}</div>}

      {sections.map((s, i) => (
        <SectionEditor key={s.id + s.status + (s.ai_at ?? "")} bidId={bidId} s={s} n={i + 1} last={i === sections.length - 1} reqNo={reqNo} reqs={reqs} aiReady={aiReady} closed={closed} busyAll={busy === "all"} />
      ))}

      {!closed && sections.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <input className="input w-72" placeholder="Add a section (e.g. Forms & certifications)" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          <button className="btn-ghost" disabled={!newTitle.trim() || Boolean(busy)} onClick={async () => { await act("add", { action: "section_add", title: newTitle.trim() }); setNewTitle(""); }}>Add section</button>
        </div>
      )}

      {review && <ReviewPanel review={review} />}
    </div>
  );
}

function Highlighted({ text }: { text: string }) {
  const parts = text.split(/(\[\[[^\]]*\]\])/g);
  return <>{parts.map((p, i) => (/^\[\[/.test(p) ? <mark key={i} className="bg-yellow-200 px-0.5">{p}</mark> : <span key={i}>{p}</span>))}</>;
}

function SectionEditor({ bidId, s, n, last, reqNo, reqs, aiReady, closed, busyAll }: {
  bidId: string; s: WsSection; n: number; last: boolean; reqNo: Record<string, number>; reqs: { id: string; text: string }[]; aiReady: boolean; closed: boolean; busyAll: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState(s.content);
  const [title, setTitle] = useState(s.title);
  const [limit, setLimit] = useState(s.page_limit ? String(s.page_limit) : "");
  const [instr, setInstr] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(s.status !== "approved");
  const dirty = text !== s.content || title !== s.title || limit !== (s.page_limit ? String(s.page_limit) : "");
  const needs = needsInput(text);
  const pages = wordsToPages(wordCount(text));
  const locked = closed || s.status === "approved";
  const call = async (label: string, body: Record<string, unknown>) => {
    setBusy(label); setMsg("");
    const r = await post({ bid_id: bidId, ...body });
    setBusy("");
    if (!r.ok) setMsg(String(r.error ?? "Failed"));
    router.refresh();
    return r;
  };
  const save = () => call("save", { action: "section_save", id: s.id, title: title.trim() || s.title, page_limit: limit ? Number(limit) : null, ...(text !== s.content ? { content: text } : {}) });
  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-2">
        <button className="text-left font-bold" onClick={() => setOpen(!open)}>{open ? "▾" : "▸"} {n}. {s.title}</button>
        <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[s.status]}`}>{PROPOSAL_STATUS_LABEL[s.status]}</span>
        {needs.length > 0 && <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-900">{needs.length} to fill</span>}
        <span className={`text-xs ${s.page_limit && pages > s.page_limit ? "font-semibold text-rose-700" : "text-ink-soft"}`}>≈{pages} pp{s.page_limit ? ` / limit ${s.page_limit}` : ""}</span>
        {!closed && (
          <span className="ml-auto flex gap-1">
            <button className="btn-ghost px-2 py-0.5 text-xs" disabled={n === 1} onClick={() => call("move", { action: "section_move", id: s.id, dir: -1 })} aria-label="Move up">↑</button>
            <button className="btn-ghost px-2 py-0.5 text-xs" disabled={last} onClick={() => call("move", { action: "section_move", id: s.id, dir: 1 })} aria-label="Move down">↓</button>
            <button className="btn-ghost px-2 py-0.5 text-xs text-rose-700" onClick={() => { if (confirm(`Delete the section "${s.title}"?`)) void call("delete", { action: "section_delete", id: s.id }); }} aria-label="Delete section">✕</button>
          </span>
        )}
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          {s.guidance && <p className="text-xs text-ink-soft"><b>Must cover:</b> {s.guidance}</p>}
          {s.requirement_ids.length > 0 && (
            <details className="text-xs text-ink-soft">
              <summary className="cursor-pointer">Answers {s.requirement_ids.length} compliance item{s.requirement_ids.length > 1 ? "s" : ""}</summary>
              <ul className="mt-1 list-disc pl-5">{s.requirement_ids.map((id) => <li key={id}>R{reqNo[id] ?? "?"}: {reqs.find((r) => r.id === id)?.text ?? "(removed)"}</li>)}</ul>
            </details>
          )}
          {!locked && (
            <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Section title" />
              <input className="input" inputMode="decimal" placeholder="Page limit" value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^\d.]/g, ""))} aria-label="Page limit" />
            </div>
          )}
          {locked
            ? <div className="whitespace-pre-wrap rounded-lg bg-paper p-3 leading-relaxed"><Highlighted text={s.content || "(empty)"} /></div>
            : <textarea className="input min-h-72 font-[inherit] leading-relaxed" value={text} placeholder={aiReady ? "Press “Write with AI”, or write it yourself." : "Write this section."} onChange={(e) => setText(e.target.value)} />}
          {needs.length > 0 && <div className="rounded-lg bg-yellow-50 p-2 text-xs"><b>Fill in before approving:</b><ul className="list-disc pl-5">{needs.map((x) => <li key={x}>{x}</li>)}</ul></div>}
          {!closed && (
            <div className="flex flex-wrap items-center gap-2">
              {s.status === "approved"
                ? <button className="btn-ghost text-xs" disabled={Boolean(busy)} onClick={() => call("unapprove", { action: "section_approve", id: s.id, approve: false })}>Un-approve to edit</button>
                : <>
                    {dirty && <button className="btn-primary text-xs" disabled={Boolean(busy)} onClick={save}>{busy === "save" ? "Saving…" : "Save"}</button>}
                    <input className="input w-64 text-xs" placeholder="Tell the AI what to change (optional)" value={instr} onChange={(e) => setInstr(e.target.value)} />
                    <button className="btn-ghost text-xs" disabled={Boolean(busy) || busyAll || !aiReady || dirty} title={dirty ? "Save your edits first" : ""} onClick={async () => { const r = await call("draft", { action: "draft_section", section_id: s.id, instruction: instr.trim() || null }); if (r.ok) setInstr(""); }}>{busy === "draft" ? "Writing…" : s.content.trim() ? "✨ Rewrite with AI" : "✨ Write with AI"}</button>
                    <button className="btn-ghost text-xs" disabled={Boolean(busy) || dirty || !text.trim() || needs.length > 0} title={dirty ? "Save first" : needs.length ? "Fill the [[NEEDS]] items first" : ""} onClick={() => call("approve", { action: "section_approve", id: s.id, approve: true })}>✅ Approve</button>
                  </>}
              {s.approved_by && <span className="text-xs text-ink-soft">Approved by {s.approved_by}</span>}
              {msg && <span className="text-xs text-rose-700">{msg}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewPanel({ review }: { review: WsReview }) {
  return (
    <div className="card space-y-3">
      <div className="flex items-baseline justify-between"><h3 className="text-base font-bold">🔍 AI evaluator review</h3><span className="text-xs text-ink-soft">{new Date(review.at).toLocaleString("en-US", { timeZone: "America/Detroit", dateStyle: "medium", timeStyle: "short" })} · edits since then aren't reflected</span></div>
      <p>{review.verdict}</p>
      {review.risky_claims.length > 0 && <div><b className="text-rose-700">Claims to back up or remove</b><ul className="list-disc pl-5">{review.risky_claims.map((c, i) => <li key={i}><b>{c.section}:</b> “{c.claim}” — {c.why}</li>)}</ul></div>}
      {review.missing_requirements.length > 0 && <div><b className="text-amber-800">Requirements not clearly answered</b><ul className="list-disc pl-5">{review.missing_requirements.map((m, i) => <li key={i}>R{m.requirement_number}: {m.issue}</li>)}</ul></div>}
      {review.weaknesses.length > 0 && <div><b>Weak spots</b><ul className="list-disc pl-5">{review.weaknesses.map((w, i) => <li key={i}><b>{w.section}:</b> {w.issue} <span className="text-ink-soft">→ {w.fix}</span></li>)}</ul></div>}
      {review.format_issues.length > 0 && <div><b>Format</b><ul className="list-disc pl-5">{review.format_issues.map((f, i) => <li key={i}>{f}</li>)}</ul></div>}
      {review.strengths.length > 0 && <div><b className="text-green-800">Strengths</b><ul className="list-disc pl-5">{review.strengths.map((f, i) => <li key={i}>{f}</li>)}</ul></div>}
    </div>
  );
}

// ───────────────────────────── bidding profiles ─────────────────────────────

const FIELDS: { k: string; label: string; area?: boolean; hint?: string }[] = [
  { k: "name", label: "Profile name *", hint: "e.g. IEBC — business & technology consulting" },
  { k: "legal_name", label: "Legal name (as registered in SAM.gov)" },
  { k: "uei", label: "UEI" }, { k: "cage", label: "CAGE code" },
  { k: "business_size", label: "Business size" }, { k: "certifications", label: "Certifications / socio-economic status", hint: "Only ones you hold: HUBZone, 8(a), WOSB, SDVOSB, Michigan GDBE, Detroit-Based…" },
  { k: "naics", label: "NAICS codes" }, { k: "address", label: "Address" },
  { k: "poc_name", label: "Point of contact" }, { k: "poc_title", label: "Title" },
  { k: "email", label: "Email" }, { k: "phone", label: "Phone" }, { k: "website", label: "Website" },
  { k: "overview", label: "Company overview", area: true },
  { k: "capabilities", label: "Capabilities", area: true },
  { k: "differentiators", label: "Differentiators", area: true },
  { k: "past_performance", label: "Past performance — real contracts and clients only", area: true, hint: "For each: customer, contract number, dates, value, what you did, results, reference name / email / phone." },
  { k: "key_personnel", label: "Key personnel — real people only", area: true, hint: "Name, role on the contract, experience, education, certifications." },
  { k: "boilerplate", label: "Standard language", area: true, hint: "Quality control plan, security and data handling, AI governance and oversight, accessibility, transition-in. The AI reuses it." },
];

export function ProfileEditor({ profile }: { profile: Record<string, unknown> | null }) {
  const router = useRouter();
  const [f, setF] = useState<Record<string, string>>(() => Object.fromEntries(FIELDS.map((x) => [x.k, String(profile?.[x.k] ?? "")])));
  const [def, setDef] = useState(Boolean(profile?.is_default));
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const id = profile?.id as string | undefined;
  return (
    <div className="card space-y-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.filter((x) => !x.area).map((x) => (
          <label key={x.k} className="block"><span className="text-xs font-semibold text-ink-soft">{x.label}</span><input className="input mt-1" placeholder={x.hint} value={f[x.k]} onChange={(e) => setF({ ...f, [x.k]: e.target.value })} /></label>
        ))}
      </div>
      {FIELDS.filter((x) => x.area).map((x) => (
        <label key={x.k} className="block"><span className="text-xs font-semibold text-ink-soft">{x.label}</span>{x.hint && <span className="block text-xs text-ink-soft">{x.hint}</span>}<textarea className="input mt-1 min-h-28" value={f[x.k]} onChange={(e) => setF({ ...f, [x.k]: e.target.value })} /></label>
      ))}
      <label className="flex items-center gap-2"><input type="checkbox" checked={def} onChange={(e) => setDef(e.target.checked)} /> Default for new bids</label>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" disabled={busy} onClick={async () => {
          setBusy(true);
          const r = await post({ action: "profile_save", ...(id ? { id } : {}), ...f, is_default: def });
          setBusy(false); setMsg(r.ok ? "Saved." : String(r.error ?? "Failed"));
          if (r.ok && !id) setF(Object.fromEntries(FIELDS.map((x) => [x.k, ""])));
          router.refresh();
        }}>{busy ? "Saving…" : id ? "Save profile" : "Add profile"}</button>
        {id && <button className="btn-ghost text-rose-700" onClick={async () => { if (!confirm("Delete this profile? Bids using it fall back to the default.")) return; await post({ action: "profile_delete", id }); router.refresh(); }}>Delete</button>}
        {msg && <span className="text-ink-soft">{msg}</span>}
      </div>
    </div>
  );
}
