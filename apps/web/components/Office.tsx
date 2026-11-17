/*
 * FILE    : apps/web/components/Office.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2300 UTC
 * PURPOSE : Front Office → office widgets (client): compose / reply from the office's mailbox, schedule a Zoom meeting
 *           (optionally emailing the invite), test the mailbox login, and the shared to-do board between the offices
 *           (TodoBoard: on my desk / with the other office, send back and forth, done, notes, history). All POST /api/hub/office.
 */
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

async function call(body: Record<string, unknown>) {
  const r = await fetch("/api/hub/office", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data } as { ok: boolean; data: { error?: string; [k: string]: unknown } };
}

export function OfficeCompose({ office, first, defaultTo = "" }: { office: string; first: string; defaultTo?: string }) {
  const [f, setF] = useState({ to: defaultTo, subject: "", text: "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2 text-sm">
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="input" placeholder="To" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
        <input className="input" placeholder="Subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
      </div>
      <textarea className="input h-28" placeholder={`Message (${first}'s name and title are added as the signature)`} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
      <div className="flex items-center gap-2">
        <button className="btn-primary" disabled={busy || !f.to.includes("@") || !f.subject || !f.text} onClick={async () => {
          setBusy(true); const r = await call({ action: "compose", office, ...f }); setBusy(false);
          if (r.ok) { setF({ to: "", subject: "", text: "" }); setMsg("Sent."); } else setMsg(r.data.error ?? "Failed");
        }}>Send</button>
        {msg && <span className="text-ink-soft">{msg}</span>}
      </div>
    </div>
  );
}

export function OfficeReply({ office, uid, to, subject, inReplyTo, references }: { office: string; uid: number; to: string; subject: string; inReplyTo: string | null; references: string | null }) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2 text-sm">
      <textarea className="input h-32" placeholder="Your reply" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex items-center gap-2">
        <button className="btn-primary" disabled={busy || !text} onClick={async () => {
          setBusy(true);
          const r = await call({ action: "reply", office, uid, to, subject: /^re:/i.test(subject) ? subject : `Re: ${subject}`, text, in_reply_to: inReplyTo, references: [references, inReplyTo].filter(Boolean).join(" ") || null });
          setBusy(false);
          if (r.ok) { setText(""); setMsg("Sent."); } else setMsg(r.data.error ?? "Failed");
        }}>Reply</button>
        {msg && <span className="text-ink-soft">{msg}</span>}
      </div>
    </div>
  );
}

/** Next half hour, as a value for <input type="datetime-local"> (the browser's time zone). */
const nextSlot = () => {
  const d = new Date(Date.now() + 30 * 60000); d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function ZoomScheduler({ office, ready, defaultTopic = "", defaultInvite = "" }: { office: string; ready: boolean; defaultTopic?: string; defaultInvite?: string }) {
  const router = useRouter();
  const [f, setF] = useState({ topic: defaultTopic, start: nextSlot(), minutes: 30, invite: defaultInvite, note: "" });
  const [out, setOut] = useState<{ join?: string; start?: string; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!ready) return <p className="text-sm text-ink-soft">Connect Zoom to schedule meetings from here (see "Setup" below). You can still use the personal room link.</p>;
  return (
    <div className="space-y-2 text-sm">
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="input" placeholder="Topic (e.g. Interview: Smith Plumbing)" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} />
        <input className="input" type="datetime-local" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
        <select className="input" value={f.minutes} onChange={(e) => setF({ ...f, minutes: Number(e.target.value) })}>
          {[15, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} minutes</option>)}
        </select>
        <input className="input" placeholder="Invite (email, optional)" value={f.invite} onChange={(e) => setF({ ...f, invite: e.target.value })} />
      </div>
      <textarea className="input h-16" placeholder="Note for the invite (optional)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" disabled={busy || f.topic.trim().length < 2 || !f.start} onClick={async () => {
          setBusy(true);
          const r = await call({ action: "zoom", office, topic: f.topic, start: new Date(f.start).toISOString(), minutes: f.minutes, invite: f.invite.trim() || null, note: f.note || null });
          setBusy(false);
          if (!r.ok) { setOut({ msg: r.data.error ?? "Failed" }); return; }
          const m = r.data.meeting as { join_url: string; start_url: string };
          setOut({ join: m.join_url, start: m.start_url, msg: (r.data.warning as string) ?? (r.data.invited ? `Scheduled, and the invite went to ${f.invite}.` : "Scheduled.") });
          router.refresh();
        }}>Schedule Zoom</button>
        {out && <span className="text-ink-soft">{out.msg}</span>}
      </div>
      {out?.join && (
        <p className="text-xs">
          <a className="font-semibold text-brand underline" href={out.start} target="_blank" rel="noreferrer">Start as host</a> ·{" "}
          <button className="text-brand underline" onClick={() => navigator.clipboard?.writeText(out.join!)}>Copy join link</button>
        </p>
      )}
    </div>
  );
}

export function VerifyMailbox({ office }: { office: string }) {
  const [msg, setMsg] = useState("");
  return (
    <span className="text-xs">
      <button className="text-brand underline" onClick={async () => {
        setMsg("Checking…");
        const r = await call({ action: "verify", office });
        setMsg(r.ok ? `Sending: ${r.data.smtp} · Inbox: ${r.data.imap}` : r.data.error ?? "Failed");
      }}>Test mailbox</button>{msg && <span className="ml-2 text-ink-soft">{msg}</span>}
    </span>
  );
}

// ─── the shared to-do list between the two offices ───
export interface TodoView {
  id: string; title: string; details: string | null; created_by_office: string; assigned_to: string; due_date: string | null; priority: "normal" | "high"; status: "open" | "done";
  history: { at: string; office: string; action: string; note?: string | null }[]; done_at: string | null;
}
type Names = Record<string, string>;
const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Detroit", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const overdue = (d: string | null) => Boolean(d && d < new Date().toISOString().slice(0, 10));

function TodoItem({ t, office, other, names }: { t: TodoView; office: string; other: string; names: Names }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true); setErr("");
    const r = await call({ action, office, id: t.id, note: note.trim() || null, ...extra });
    setBusy(false);
    if (r.ok) { setNote(""); router.refresh(); } else setErr(r.data.error ?? "Failed");
  };
  const mine = t.assigned_to === office;
  const last = t.history[t.history.length - 1];
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button className="text-left" onClick={() => setOpen(!open)}>
          <span className={`font-semibold ${t.status === "done" ? "text-ink-soft line-through" : ""}`}>{t.priority === "high" && t.status === "open" && <span className="mr-1 rounded bg-rose-100 px-1.5 text-xs text-rose-800">High</span>}{t.title}</span>
          <span className="block text-xs text-ink-soft">
            {t.status === "done" ? `Done ${t.done_at ? fmt(t.done_at) : ""}` : mine ? `From ${names[t.created_by_office] ?? t.created_by_office}` : `On ${names[t.assigned_to]}'s desk`}
            {t.due_date && <span className={overdue(t.due_date) && t.status === "open" ? " font-semibold text-rose-700" : ""}> · due {t.due_date}</span>}
            {last?.note && <> · “{last.note.slice(0, 80)}”</>}
          </span>
        </button>
        <div className="flex flex-wrap gap-1 text-xs">
          {t.status === "open" && mine && <button className="btn-ghost px-2 py-1" disabled={busy} onClick={() => act("todo_done")}>✓ Done</button>}
          {t.status === "open" && <button className="btn-ghost px-2 py-1" disabled={busy} onClick={() => act("todo_send")}>{mine ? `→ Send to ${names[other]?.split(" ")[0]}` : "↩ Take it back"}</button>}
          {t.status === "done" && <button className="btn-ghost px-2 py-1" disabled={busy} onClick={() => act("todo_reopen")}>Reopen</button>}
        </div>
      </div>
      {open && (
        <div className="mt-2 space-y-2 rounded bg-paper p-2 text-xs">
          {t.details && <p className="whitespace-pre-wrap text-sm">{t.details}</p>}
          <ol className="space-y-0.5 text-ink-soft">
            {t.history.map((h, i) => <li key={i}>{fmt(h.at)} · {names[h.office] ?? h.office}: {h.action}{h.note ? ` — ${h.note}` : ""}</li>)}
          </ol>
          <div className="flex flex-wrap gap-2">
            <input className="input flex-1" placeholder="Note (goes with Send / Done, or add it on its own)" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn-ghost px-2 py-1" disabled={busy || !note.trim()} onClick={() => act("todo_note")}>Add note</button>
            <button className="px-2 py-1 text-rose-700 underline" disabled={busy} onClick={() => { if (confirm("Delete this to-do for both offices?")) void act("todo_delete"); }}>Delete</button>
          </div>
        </div>
      )}
      {err && <p className="text-xs text-rose-700">{err}</p>}
    </li>
  );
}

export function TodoBoard({ office, other, names, todos, done, error }: { office: string; other: string; names: Names; todos: TodoView[]; done: TodoView[]; error: string | null }) {
  const router = useRouter();
  const [f, setF] = useState({ title: "", details: "", to: office, due_date: "", priority: "normal" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const mine = todos.filter((t) => t.assigned_to === office);
  const theirs = todos.filter((t) => t.assigned_to !== office);
  if (error) return <p className="text-sm text-amber-800">The to-do list needs its database table: run supabase/setup/RUN_ONCE_OFFICE_TODOS_2026-11-17_2300.sql in Supabase. ({error})</p>;
  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-2 rounded border border-line p-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <input className="input" placeholder="New to-do" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <select className="input" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })}>
            <option value={office}>For me</option>
            <option value={other}>For {names[other]}</option>
          </select>
          <input className="input" type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} />
          <select className="input" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option value="normal">Normal</option><option value="high">High</option></select>
        </div>
        <textarea className="input h-14" placeholder="Details (optional)" value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} />
        <div className="flex items-center gap-2">
          <button className="btn-primary" disabled={busy || f.title.trim().length < 2} onClick={async () => {
            setBusy(true);
            const r = await call({ action: "todo_add", office, ...f, due_date: f.due_date || null });
            setBusy(false);
            if (r.ok) { setMsg(f.to === office ? "Added." : `Sent to ${names[other]}.`); setF({ title: "", details: "", to: office, due_date: "", priority: "normal" }); router.refresh(); } else setMsg(r.data.error ?? "Failed");
          }}>Add</button>
          {msg && <span className="text-ink-soft">{msg}</span>}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="font-semibold">On my desk ({mine.length})</h3>
          {mine.length ? <ul className="divide-y divide-line">{mine.map((t) => <TodoItem key={t.id} t={t} office={office} other={other} names={names} />)}</ul> : <p className="text-ink-soft">Nothing — all clear.</p>}
        </div>
        <div>
          <h3 className="font-semibold">With {names[other]} ({theirs.length})</h3>
          {theirs.length ? <ul className="divide-y divide-line">{theirs.map((t) => <TodoItem key={t.id} t={t} office={office} other={other} names={names} />)}</ul> : <p className="text-ink-soft">Nothing waiting on them.</p>}
        </div>
      </div>
      {done.length > 0 && (
        <details>
          <summary className="cursor-pointer text-ink-soft">Recently done ({done.length})</summary>
          <ul className="divide-y divide-line">{done.map((t) => <TodoItem key={t.id} t={t} office={office} other={other} names={names} />)}</ul>
        </details>
      )}
    </div>
  );
}
