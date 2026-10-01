/*
 * FILE    : apps/web/components/HubActions.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Interactive controls for the Ops Hub.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { JOB_STATUSES, JOB_STATUS_LABEL } from "@handled/core";

async function call(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

export function ResolveAlert({ id }: { id: string }) {
  const router = useRouter();
  return <button className="text-xs text-ink-soft underline" onClick={async () => { await call(`/api/hub/alerts/${id}`, "POST", {}); router.refresh(); }}>Resolve</button>;
}

export function JobAdmin({ job, pros }: { job: { id: string; status: string; price_final: number | null; scheduled_date: string | null; contractor_id: string | null }; pros: { id: string; business_name: string }[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [price, setPrice] = useState(job.price_final?.toString() ?? "");
  const [date, setDate] = useState(job.scheduled_date ?? "");
  const [note, setNote] = useState("");

  async function run(fn: () => Promise<{ ok: boolean; json: { error?: string; offers?: number } }>, done: string) {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    setMsg(r.ok ? (r.json.offers !== undefined ? `Offers sent: ${r.json.offers}` : done) : r.json.error ?? "Failed");
    router.refresh();
  }
  const patch = (body: object, done = "Saved") => run(() => call(`/api/hub/jobs/${job.id}`, "PATCH", body), done);

  return (
    <div className="card space-y-4">
      <div className="font-semibold">Actions</div>
      <div className="flex flex-wrap gap-2">
        {!job.contractor_id && <button className="btn-primary" disabled={busy} onClick={() => run(() => call("/api/hub/dispatch", "POST", { jobId: job.id, siteVisit: job.status === "site_visit" }), "Dispatched")}>✨ AI dispatch</button>}
        {job.status === "qa_review" && <button className="btn-primary" disabled={busy} onClick={() => patch({ approve_qa: true }, "Approved & closed")}>Approve QA & close</button>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">Firm price</label><div className="flex gap-1"><input className="input" type="number" value={price} onChange={(e) => setPrice(e.target.value)} /><button className="btn-ghost px-3" disabled={!price} onClick={() => patch({ price_final: Number(price), status: job.status === "site_visit" ? "quoted" : undefined })}>Set</button></div></div>
        <div><label className="label">Date</label><div className="flex gap-1"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /><button className="btn-ghost px-3" disabled={!date} onClick={() => patch({ scheduled_date: date })}>Set</button></div></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">Status</label>
          <select className="input" value={job.status} onChange={(e) => patch({ status: e.target.value })}>{JOB_STATUSES.map((s) => <option key={s} value={s}>{JOB_STATUS_LABEL[s]}</option>)}</select></div>
        <div><label className="label">Assign pro directly</label>
          <select className="input" value={job.contractor_id ?? ""} onChange={(e) => patch({ contractor_id: e.target.value || null })}><option value="">—</option>{pros.map((p) => <option key={p.id} value={p.id}>{p.business_name}</option>)}</select></div>
      </div>
      <div><label className="label">Internal note</label><div className="flex gap-1"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /><button className="btn-ghost px-3" disabled={!note} onClick={() => { patch({ note }); setNote(""); }}>Add</button></div></div>
      {msg && <p className="text-sm text-brand-dark">{msg}</p>}
    </div>
  );
}

export function ApplicationButtons({ id }: { id: string }) {
  const router = useRouter();
  const act = async (decision: string) => { await call(`/api/hub/applications/${id}`, "POST", { decision }); router.refresh(); };
  return <div className="flex gap-2"><button className="btn-ghost px-3 py-1" onClick={() => act("reject")}>Reject</button><button className="btn-primary px-3 py-1" onClick={() => act("approve")}>Approve → vetting</button></div>;
}

export function ActivatePro({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [msg, setMsg] = useState("");
  if (status === "approved")
    return <button className="text-xs text-rose-700 underline" onClick={async () => { await call(`/api/hub/contractors/${id}`, "PATCH", { status: "suspended" }); router.refresh(); }}>Suspend</button>;
  return (
    <div className="flex flex-wrap items-center gap-1">
      <input type="date" className="input w-36 py-1 text-xs" title="Insurance valid until" value={date} onChange={(e) => setDate(e.target.value)} />
      <button className="btn-primary px-3 py-1 text-xs" disabled={!date} onClick={async () => {
        const r = await call(`/api/hub/contractors/${id}`, "PATCH", { insured_until: date, background_checked: true, status: "approved" });
        setMsg(r.ok ? "" : r.json.error ?? "Failed");
        router.refresh();
      }}>COI + background ✓ → Activate</button>
      {msg && <span className="text-xs text-rose-700">{msg}</span>}
    </div>
  );
}

export function PayoutButton({ id }: { id: string }) {
  const router = useRouter();
  return <button className="btn-ghost px-3 py-1 text-xs" onClick={async () => { await call(`/api/hub/payouts/${id}`, "POST", { status: "paid" }); router.refresh(); }}>Mark paid</button>;
}

export function AssistantChat() {
  const [turns, setTurns] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const examples = ["What's unassigned for tomorrow?", "Give me this week's revenue and margin by service", "Which jobs are stuck in QA review?", "Who are our top 3 pros for hauling?"];
  async function send(q: string) {
    if (!q.trim()) return;
    const next = [...turns, { role: "user" as const, content: q.trim() }];
    setTurns(next);
    setText("");
    setBusy(true);
    const { json } = await call("/api/hub/assistant", "POST", { messages: next });
    setTurns([...next, { role: "assistant", content: json.reply ?? "Error" }]);
    setBusy(false);
  }
  return (
    <div className="card flex h-[70vh] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto text-sm">
        {!turns.length && <div className="grid gap-2 sm:grid-cols-2">{examples.map((e) => <button key={e} onClick={() => send(e)} className="rounded-xl border border-line p-3 text-left hover:border-brand">{e}</button>)}</div>}
        {turns.map((t, i) => <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 ${t.role === "user" ? "ml-auto bg-ink text-white" : "bg-paper"}`}>{t.content}</div>)}
        {busy && <div className="w-fit rounded-2xl bg-paper px-4 py-2.5 text-ink-soft">Checking live data…</div>}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(text); }}><input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about jobs, pros, revenue — or tell it to re-dispatch a job" /><button className="btn-primary" disabled={busy}>Ask</button></form>
    </div>
  );
}

export function AgentControls({ id, autonomy, active }: { id: string; autonomy: string; active: boolean }) {
  const router = useRouter();
  const patch = async (body: object) => { await call(`/api/hub/agents/${id}`, "PATCH", body); router.refresh(); };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className="input w-auto py-1 text-xs" value={autonomy} onChange={(e) => patch({ autonomy: e.target.value })}>
        <option value="suggest">Suggest only</option>
        <option value="approval">Act with approval</option>
        <option value="autonomous">Autonomous (low-risk)</option>
      </select>
      <button className="text-xs underline" onClick={() => patch({ active: !active })}>{active ? "Pause" : "Resume"}</button>
    </div>
  );
}

export function ActionDecision({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const decide = async (decision: "approve" | "reject") => {
    setBusy(true);
    const r = await call(`/api/hub/agent-actions/${id}`, "POST", { decision });
    setBusy(false);
    if (!r.ok || r.json.status === "failed") setMsg(r.json.error ?? "Failed");
    router.refresh();
  };
  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-rose-700">{msg}</span>}
      <button className="btn-ghost px-3 py-1 text-xs" disabled={busy} onClick={() => decide("reject")}>Reject</button>
      <button className="btn-primary px-3 py-1 text-xs" disabled={busy} onClick={() => decide("approve")}>Approve & run</button>
    </div>
  );
}
