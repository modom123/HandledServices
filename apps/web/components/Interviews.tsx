/*
 * FILE    : apps/web/components/Interviews.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_0246 UTC
 * PURPOSE : Hub controls for screening interviews: send the AI interview link, score an interview you do in person
 *           or by phone (the packet's questions, 1–5 per competency, notes, knockouts), score an unfinished AI
 *           interview, and decide (invite / follow up / decline).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COMPETENCIES, scoreInterview, RESULT_LABEL, type Competency, type InterviewQuestion } from "@handled/core";

async function call(body: Record<string, unknown>) {
  const r = await fetch("/api/hub/interviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok && j.ok !== false, data: j as Record<string, unknown> & { error?: string } };
}

export function StartInterview({ appId, aiReady }: { appId: string; aiReady: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <button className="btn-primary" disabled={!aiReady} title={aiReady ? "" : "Set ANTHROPIC_API_KEY to use the AI interviewer"} onClick={async () => { const r = await call({ action: "start", application_id: appId, mode: "ai" }); setMsg(r.ok ? "AI interview link emailed." : r.data.error ?? "Failed"); router.refresh(); }}>🤖 Email the AI interview link</button>
      <a className="btn-ghost" href={`/hub/recruiting/${appId}?scorecard=1#scorecard`}>📝 Interview them myself</a>
      {msg && <span className="text-ink-soft">{msg}</span>}
    </div>
  );
}

export function Scorecard({ appId, plan, initial }: { appId: string; plan: InterviewQuestion[]; initial?: { scores: { competency: Competency; score: number; evidence?: string | null }[]; answers: Record<string, string>; notes: string | null; knockouts: string[] } }) {
  const router = useRouter();
  const comps = Object.keys(COMPETENCIES) as Competency[];
  const [scores, setScores] = useState<Record<string, number>>(Object.fromEntries((initial?.scores ?? []).map((s) => [s.competency, s.score])));
  const [ev, setEv] = useState<Record<string, string>>(Object.fromEntries((initial?.scores ?? []).map((s) => [s.competency, s.evidence ?? ""])));
  const [answers, setAnswers] = useState<Record<string, string>>(initial?.answers ?? {});
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [ko, setKo] = useState<string[]>(initial?.knockouts ?? []);
  const [msg, setMsg] = useState("");
  const list = comps.filter((c) => scores[c]).map((c) => ({ competency: c, score: scores[c], evidence: ev[c] || null }));
  const preview = scoreInterview(list, ko);
  const KOS = ["Won't carry required insurance", "Would do licensed work without the license", "Would knowingly continue unsafe work", "Abusive or threatening in the interview"];
  const save = async (complete: boolean) => {
    const r = await call({ action: "scorecard", application_id: appId, scores: list, answers, knockouts: ko, notes: notes || null, complete });
    setMsg(r.ok ? (complete ? "Saved and completed." : "Draft saved.") : r.data.error ?? "Failed"); router.refresh();
  };
  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-3">
        {plan.map((q, i) => (
          <div key={q.id} className="rounded-xl border border-line p-3">
            <div className="font-semibold">{i + 1}. {q.en}</div>
            <div className="text-xs text-ink-soft">{q.es}</div>
            <div className="mt-1 text-xs text-brand-dark">Look for: {q.lookFor}{q.redFlag ? <span className="text-rose-700"> · Red flag: {q.redFlag}</span> : null}{q.competency ? <span className="text-ink-soft"> · scores {COMPETENCIES[q.competency].en}</span> : null}</div>
            <textarea className="input mt-2 h-16 text-xs" placeholder="Their answer (notes)" value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-paper p-3">
        <div className="mb-2 font-semibold">Scores (1–5)</div>
        {comps.map((c) => (
          <div key={c} className="mb-2">
            <div className="flex flex-wrap items-center gap-2"><span className="w-56 font-medium">{COMPETENCIES[c].en}</span>
              {[1, 2, 3, 4, 5].map((n) => <button key={n} className={`h-8 w-8 rounded-full border ${scores[c] === n ? "border-brand bg-brand text-white" : "border-line bg-white"}`} onClick={() => setScores({ ...scores, [c]: n })}>{n}</button>)}
              <input className="input flex-1 text-xs" placeholder="Evidence (what they said)" value={ev[c] ?? ""} onChange={(e) => setEv({ ...ev, [c]: e.target.value })} />
            </div>
            <div className="text-xs text-ink-soft">1 {COMPETENCIES[c].anchors[1]} · 3 {COMPETENCIES[c].anchors[3]} · 5 {COMPETENCIES[c].anchors[5]}</div>
          </div>
        ))}
        <div className="mt-2 font-semibold">Knockouts</div>
        {KOS.map((k) => <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={ko.includes(k)} onChange={(e) => setKo(e.target.checked ? [...ko, k] : ko.filter((x) => x !== k))} /> {k}</label>)}
        <textarea className="input mt-2 h-20" placeholder="Overall notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="mt-2">Result so far: <b>{RESULT_LABEL[preview.result]}</b> <span className="text-ink-soft">({preview.why})</span></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-ghost" onClick={() => save(false)}>Save draft</button>
        <button className="btn-primary" disabled={list.length < 6} onClick={() => save(true)}>Complete interview</button>
        {list.length < 6 && <span className="text-xs text-ink-soft">Score all six to complete.</span>}
        {msg && <span className="text-ink-soft">{msg}</span>}
      </div>
    </div>
  );
}

export function InterviewDecision({ id, decided, canFinish }: { id: string; decided: string | null; canFinish: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const decide = async (decision: string) => {
    if (decision === "decline" && !confirm("Decline? They get a polite email.")) return;
    const r = await call({ action: "decide", id, decision, reason: reason || null });
    setMsg(r.ok ? (decision === "invite" ? "Invited — setup email sent." : "Saved.") : r.data.error ?? "Failed"); router.refresh();
  };
  return (
    <div className="space-y-2 text-sm">
      {decided && <div className="text-ink-soft">Decision so far: <b>{decided}</b></div>}
      <input className="input" placeholder="Reason / note (optional; a decline reason goes in their email)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => decide("invite")}>Invite to set up</button>
        <button className="btn-ghost" onClick={() => decide("follow_up")}>Follow up first</button>
        <button className="btn-ghost text-rose-700" onClick={() => decide("decline")}>Decline</button>
        {canFinish && <button className="btn-ghost" onClick={async () => { await call({ action: "finish", id }); router.refresh(); }}>Score it now (left early)</button>}
      </div>
      {msg && <p className="text-ink-soft">{msg}</p>}
    </div>
  );
}
