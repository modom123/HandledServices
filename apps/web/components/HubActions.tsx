/*
 * FILE    : apps/web/components/HubActions.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Interactive controls for the Handled Hub.
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

export function JobAdmin({ job, pros }: { job: { id: string; status: string; price_final: number | null; scheduled_date: string | null; contractor_id: string | null; instructions?: string | null }; pros: { id: string; business_name: string }[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [price, setPrice] = useState(job.price_final?.toString() ?? "");
  const [date, setDate] = useState(job.scheduled_date ?? "");
  const [note, setNote] = useState("");
  const [instructions, setInstructions] = useState(job.instructions ?? "");

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
      <div><label className="label">Instructions for the pro (printed on the work order)</label>
        <textarea className="input min-h-20" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Gate code, parking, what to bring, who to ask for…" />
        <button className="btn-ghost mt-1 px-3 py-1 text-xs" onClick={() => patch({ instructions: instructions || null }, "Instructions saved")}>Save instructions</button></div>
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
        {turns.map((t, i) => <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 ${t.role === "user" ? "ml-auto bg-brand-deep text-white" : "bg-paper"}`}>{t.content}</div>)}
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

export function PaymentPanel({ job }: { job: { id: string; ref: string; price_final: number | null; paid_at: string | null; amount_paid: number; amount_refunded: number; remedy: string | null; status: string; payment_plan?: string; deposit_amount?: number | null; deposit_paid_at?: string | null; balance_due_date?: string | null } }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [method, setMethod] = useState("card by phone");
  const price = Number(job.price_final ?? 0), paid = Number(job.amount_paid ?? 0);
  const due = Math.max(0, price - paid);
  const deposit = job.payment_plan === "deposit";
  const [amt, setAmt] = useState(String(deposit && !job.deposit_paid_at ? job.deposit_amount ?? due : due));
  const act = async (body: object, done: string) => {
    const r = await call(`/api/hub/jobs/${job.id}`, "PATCH", body);
    setMsg(r.ok ? done : r.json.error ?? "Failed");
    router.refresh();
  };
  return (
    <div className="card space-y-3 text-sm">
      <div className="font-semibold">Payment <span className="text-xs font-normal text-ink-soft">— {deposit ? `deposit plan (${job.deposit_amount ? `$${job.deposit_amount} down` : ""}${job.balance_due_date ? `, balance due ${job.balance_due_date}` : ""})` : "paid upfront"}</span></div>
      {job.remedy ? <p className="text-ink-soft">Remedy job ({job.remedy}) — nothing owed by the customer.</p>
        : !job.price_final ? <p className="text-ink-soft">No firm price yet — set it after the site visit and a payment link goes out automatically.</p>
        : (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-paper p-2"><div className="text-xs text-ink-soft">Price</div><b>${price}</b></div>
              <div className="rounded-xl bg-paper p-2"><div className="text-xs text-ink-soft">Paid</div><b className="text-brand-dark">${paid}</b>{Number(job.amount_refunded) > 0 && <div className="text-xs text-rose-700">−${job.amount_refunded} refunded</div>}</div>
              <div className="rounded-xl bg-paper p-2"><div className="text-xs text-ink-soft">Owed</div><b className={due ? "text-rose-700" : ""}>${due}</b></div>
            </div>
            {job.paid_at ? <p className="text-brand-dark">✓ Paid in full {new Date(job.paid_at).toLocaleDateString()}</p>
              : job.deposit_paid_at ? <p>Deposit paid {new Date(job.deposit_paid_at).toLocaleDateString()} — balance is charged automatically{job.balance_due_date ? ` on ${job.balance_due_date}` : ""}. The pro can’t start until it’s paid.</p>
              : <p className="text-rose-700">Unpaid — nothing is dispatched until the {deposit ? "deposit" : "payment"} is in.</p>}
            {due > 0 && (
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => act({ send_payment_link: true }, "Payment link emailed")}>Email payment link</button>
                {(job.deposit_paid_at || paid > 0) && <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => act({ charge_balance: true }, "Balance charged")}>Charge balance to saved card</button>}
              </div>
            )}
            {due > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <input className="input w-24 py-1 text-xs" value={amt} onChange={(e) => setAmt(e.target.value)} />
                <input className="input w-36 py-1 text-xs" value={method} onChange={(e) => setMethod(e.target.value)} />
                <button className="btn-ghost px-3 py-1.5 text-xs" disabled={!Number(amt)} onClick={() => act({ mark_paid: { amount: Number(amt), method } }, "Payment recorded")}>Record payment</button>
              </div>
            )}
            <a className="inline-block text-xs font-semibold text-brand underline" href={`/hub/charges?job=${job.ref}`}>+ Change order / extra charge →</a>
          </>
        )}
      {msg && <p className="text-brand-dark">{msg}</p>}
    </div>
  );
}

export function RemedyPanel({ jobId, paid, services }: { jobId: string; paid: boolean; services: { slug: string; name: string }[] }) {
  const router = useRouter();
  const [type, setType] = useState<"redo" | "complimentary" | "refund">("redo");
  const [amount, setAmount] = useState("");
  const [fault, setFault] = useState(true);
  const [svc, setSvc] = useState(services[0]?.slug ?? "");
  const [date, setDate] = useState(new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  if (!paid) return null;
  const go = async () => {
    const body = type === "refund" ? { type, amount: Number(amount), pro_at_fault: fault, reason } : type === "redo" ? { type, date, reason } : { type, service_slug: svc, date, reason };
    const r = await call(`/api/hub/jobs/${jobId}/remedy`, "POST", body);
    setMsg(r.ok ? (r.json.ref ? `Created ${r.json.ref}` : `Refunded $${r.json.refund} (pro $${r.json.fromPro} / us $${r.json.fromUs})`) : r.json.error ?? "Failed");
    router.refresh();
  };
  return (
    <div className="card space-y-3 text-sm">
      <div className="font-semibold">Make it right</div>
      <div className="flex flex-wrap gap-2">
        {(["redo", "complimentary", "refund"] as const).map((t) => (
          <button key={t} onClick={() => setType(t)} className={`rounded-full border px-3 py-1 text-xs ${type === t ? "border-brand bg-brand-tint font-semibold text-brand-dark" : "border-line"}`}>
            {t === "redo" ? "Free redo (same pro)" : t === "complimentary" ? "Free extra service" : "Refund"}
          </button>
        ))}
      </div>
      {type === "refund" ? (
        <div className="flex flex-wrap items-center gap-2">
          <input className="input w-28" type="number" placeholder="$ amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={fault} onChange={(e) => setFault(e.target.checked)} /> Pro at fault (comes out of their payout first)</label>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {type === "complimentary" && <select className="input w-auto" value={svc} onChange={(e) => setSvc(e.target.value)}>{services.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}</select>}
          <input className="input w-40" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      )}
      <input className="input" placeholder="Reason (shown to the customer)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <button className="btn-primary" disabled={reason.length < 3 || (type === "refund" && !Number(amount))} onClick={go}>Apply</button>
      <p className="text-xs text-ink-soft">Guardrails: refunds can't exceed what was paid; a free extra service is capped at our take on this job, so it can never go below $0.</p>
      {msg && <p className="text-brand-dark">{msg}</p>}
    </div>
  );
}

export function DocDecision({ contractorId, docId }: { contractorId: string; docId: string }) {
  const router = useRouter();
  const act = async (decision: "verify" | "reject") => { await call(`/api/hub/contractors/${contractorId}/documents/${docId}`, "POST", { decision }); router.refresh(); };
  return (
    <div className="flex gap-2">
      <a className="btn-ghost px-3 py-1 text-xs" href={`/api/hub/contractors/${contractorId}/documents/${docId}`} target="_blank">Open</a>
      <button className="btn-ghost px-3 py-1 text-xs" onClick={() => act("reject")}>Reject</button>
      <button className="btn-primary px-3 py-1 text-xs" onClick={() => act("verify")}>Verify</button>
    </div>
  );
}

export function ProStatusControls({ id, status, complete }: { id: string; status: string; complete: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [reason, setReason] = useState("");
  const patch = async (body: object) => { const r = await call(`/api/hub/contractors/${id}`, "PATCH", body); setMsg(r.ok ? "Saved" : r.json.error ?? "Failed"); router.refresh(); };
  return (
    <div className="card space-y-3 text-sm">
      <div className="font-semibold">Status: {status}</div>
      <div className="flex flex-wrap gap-2">
        {status !== "approved" && <button className="btn-primary px-3 py-1.5 text-xs" disabled={!complete} title={complete ? "" : "Finish onboarding first"} onClick={() => patch({ status: "approved" })}>Activate — start sending offers</button>}
        <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => patch({ background_checked: true })}>Mark background check cleared</button>
      </div>
      {status === "approved" && (
        <div className="flex gap-2"><input className="input py-1 text-xs" placeholder="Reason to pause / offboard" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="btn-ghost px-3 py-1 text-xs text-rose-700" disabled={reason.length < 3} onClick={() => patch({ offboard_reason: reason })}>Pause</button></div>
      )}
      {msg && <p className="text-brand-dark">{msg}</p>}
    </div>
  );
}

export function OpsRating({ jobId, current }: { jobId: string; current: { rating: number; quality: number | null; punctuality: number | null; professionalism: number | null; comment: string | null; source: string; rated_by: string | null } | null }) {
  const router = useRouter();
  const [r, setR] = useState({ rating: current?.rating ?? 5, quality: current?.quality ?? 5, punctuality: current?.punctuality ?? 5, professionalism: current?.professionalism ?? 5 });
  const [comment, setComment] = useState(current?.comment ?? "");
  const [msg, setMsg] = useState("");
  const Stars = ({ k }: { k: keyof typeof r }) => (
    <div className="flex items-center justify-between gap-2"><span className="capitalize text-ink-soft">{k === "rating" ? "Overall" : k}</span>
      <span className="text-lg">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setR({ ...r, [k]: n })} className={n <= r[k] ? "" : "opacity-25"}>★</button>)}</span></div>
  );
  return (
    <div className="card space-y-2 text-sm">
      <div className="font-semibold">Our rating of the pro</div>
      {current && <p className="text-xs text-ink-soft">Current: {current.rating}★ by {current.rated_by ?? current.source}{current.source === "ai_qa" ? " (AI draft — override below)" : ""}</p>}
      <Stars k="rating" /><Stars k="quality" /><Stars k="punctuality" /><Stars k="professionalism" />
      <input className="input" placeholder="Private note (not shown to the pro or customer)" value={comment} onChange={(e) => setComment(e.target.value)} />
      <button className="btn-primary" onClick={async () => { const x = await call(`/api/hub/jobs/${jobId}/rating`, "POST", { ...r, comment: comment || undefined }); setMsg(x.ok ? "Saved — pro rating updated" : x.json.error ?? "Failed"); router.refresh(); }}>Save rating</button>
      {msg && <p className="text-brand-dark">{msg}</p>}
    </div>
  );
}

export function SyncCatalogButton() {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  return (
    <div className="flex items-center gap-3">
      <button className="btn-ghost" onClick={async () => { const r = await call("/api/hub/setup", "POST", { action: "sync_catalog" }); setMsg(r.json.ok ? `Synced ${r.json.count} services` : r.json.error ?? "Failed"); router.refresh(); }}>Sync service catalog</button>
      {msg && <span className="text-sm text-ink-soft">{msg}</span>}
    </div>
  );
}

export function QuickChargeForm({ initialJobRef = "" }: { initialJobRef?: string }) {
  const router = useRouter();
  const [f, setF] = useState({ amount: "", description: "", kind: initialJobRef ? "change_order" : "custom", job_ref: initialJobRef, customer_name: "", customer_email: "" });
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ url?: string; error?: string } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  async function create() {
    setBusy(true);
    const r = await call("/api/hub/charges", "POST", { ...f, amount: Number(f.amount), job_ref: f.job_ref || undefined, customer_name: f.customer_name || undefined, customer_email: f.customer_email || undefined });
    setBusy(false);
    setOut(r.ok ? { url: r.json.url } : { error: r.json.error ?? "Failed" });
    if (r.ok) router.refresh();
  }
  return (
    <div className="card space-y-3">
      <div className="font-semibold">New payment link</div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className="label">Amount ($)</label><input className="input" inputMode="decimal" value={f.amount} onChange={set("amount")} placeholder="250" /></div>
        <div className="sm:col-span-2"><label className="label">What it’s for (customer sees this)</label><input className="input" value={f.description} onChange={set("description")} placeholder="Extra debris haul-away · Corporate party deposit · …" /></div>
        <div><label className="label">Type</label>
          <select className="input" value={f.kind} onChange={set("kind")}>
            <option value="custom">One-off charge</option><option value="change_order">Change order (adds to job price)</option>
            <option value="deposit">Deposit on a job</option><option value="balance">Balance on a job</option>
          </select></div>
        <div><label className="label">Job # (optional)</label><input className="input" value={f.job_ref} onChange={set("job_ref")} placeholder="H-1042" /></div>
        <div />
        <div><label className="label">Customer name</label><input className="input" value={f.customer_name} onChange={set("customer_name")} placeholder={f.job_ref ? "from the job" : ""} /></div>
        <div className="sm:col-span-2"><label className="label">Customer email</label><input className="input" type="email" value={f.customer_email} onChange={set("customer_email")} placeholder={f.job_ref ? "from the job" : "name@email.com"} /></div>
      </div>
      <button className="btn-primary" disabled={busy || !Number(f.amount) || f.description.length < 3} onClick={create}>{busy ? "Creating…" : "Create link & email it"}</button>
      {out?.url && (
        <div className="rounded-xl bg-brand-tint p-3 text-sm">✓ Emailed. Link: <a className="break-all font-semibold text-brand-dark underline" href={out.url} target="_blank">{out.url}</a>
          <button className="btn-ghost ml-2 px-3 py-1 text-xs" onClick={() => navigator.clipboard.writeText(out.url!)}>Copy (to text it)</button></div>
      )}
      {out?.error && <p className="text-sm text-rose-700">{out.error}</p>}
    </div>
  );
}
