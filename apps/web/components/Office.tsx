/*
 * FILE    : apps/web/components/Office.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2300 UTC
 * PURPOSE : Front Office → office widgets (client): compose / reply from the office's mailbox, schedule a Zoom meeting
 *           (optionally emailing the invite), test the mailbox login, and the shared to-do board between the offices
 *           (TodoBoard: on my desk / with the other office, send back and forth, done, notes, history). All POST /api/hub/office.
 * UPDATED : 2026-11-20_1500 UTC — `box` on the mail widgets: "leads" = the business-leads mailbox (mark@handledsvc.net) in
 *           Mark's office; reading a lead's reply links to that lead.
 * UPDATED : 2026-11-24_1500 UTC — OfficeInboxes: one Email card with a tab per inbox (Mark: his own, business leads, info@);
 *           the chosen tab is kept in the address (?inbox=) so Back and reloads keep it.
 * UPDATED : 2026-11-24_1600 UTC — box "net": an office's handledsvc.net mailbox (Cecilia's cece@handledsvc.net).
 */
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

async function call(body: Record<string, unknown>) {
  const r = await fetch("/api/hub/office", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data } as { ok: boolean; data: { error?: string; [k: string]: unknown } };
}

export function OfficeCompose({ office, first, defaultTo = "", box }: { office: string; first: string; defaultTo?: string; box?: "office" | "leads" | "company" | "net" }) {
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
          setBusy(true); const r = await call({ action: "compose", office, box, ...f }); setBusy(false);
          if (r.ok) { setF({ to: "", subject: "", text: "" }); setMsg("Sent."); } else setMsg(r.data.error ?? "Failed");
        }}>Send</button>
        {msg && <span className="text-ink-soft">{msg}</span>}
      </div>
    </div>
  );
}

export function OfficeReply({ office, uid, to, subject, inReplyTo, references, box }: { office: string; uid: number; to: string; subject: string; inReplyTo: string | null; references: string | null; box?: "office" | "leads" | "company" | "net" }) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2 text-sm">
      <textarea className="input h-32" placeholder="Your reply" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex items-center gap-2">
        <button className="btn-primary" disabled={busy || !text} onClick={async () => {
          setBusy(true);
          const r = await call({ action: "reply", office, box, uid, to, subject: /^re:/i.test(subject) ? subject : `Re: ${subject}`, text, in_reply_to: inReplyTo, references: [references, inReplyTo].filter(Boolean).join(" ") || null });
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

export function VerifyMailbox({ office, box }: { office: string; box?: "office" | "leads" | "company" | "net" }) {
  const [msg, setMsg] = useState("");
  return (
    <span className="text-xs">
      <button className="text-brand underline" onClick={async () => {
        setMsg("Checking…");
        const r = await call({ action: "verify", office, box });
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

// ─── the office mailbox, read in place (2026-11-17_2330): opening an email never leaves the office page, and the
//     browser's Back button just closes the email (history entry ?mail=<uid>) ───
interface MailItem { uid: number; from: string; fromName: string | null; subject: string; date: string; seen: boolean }
interface MailFull extends MailItem { to: string; text: string; messageId: string | null; references: string | null }

export function OfficeMail({ office, first, box = "office" }: { office: string; first: string; box?: "office" | "leads" | "company" | "net" }) {
  // each inbox keeps its own browser-history key, so Back closes the right one
  const key = box === "leads" ? "lead_mail" : box === "company" ? "info_mail" : box === "net" ? "net_mail" : "mail";
  const [lead, setLead] = useState<{ id: string; business_name: string | null; status: string } | null>(null);
  const [items, setItems] = useState<MailItem[] | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<MailFull | null>(null);
  const [loading, setLoading] = useState<number | null>(null);
  const [compose, setCompose] = useState(false);

  const load = async () => {
    setErr("");
    const r = await call({ action: "inbox", office, box, limit: 25 });
    if (r.ok) setItems(r.data.items as MailItem[]); else { setErr(r.data.error ?? "Couldn't load the inbox"); setItems((x) => x ?? []); }
  };
  const show = async (uid: number, push: boolean) => {
    setLoading(uid); setErr("");
    const r = await call({ action: "read", office, box, uid });
    setLoading(null);
    if (!r.ok) { setErr(r.data.error ?? "Couldn't open that email"); return; }
    setOpen(r.data.message as MailFull);
    setLead((r.data.lead as typeof lead) ?? null);
    setItems((xs) => xs?.map((m) => (m.uid === uid ? { ...m, seen: true } : m)) ?? xs);
    if (push) window.history.pushState({ [key]: uid }, "", `?${key}=${uid}`);
  };
  const close = () => {
    if (window.history.state?.[key]) window.history.back(); // pops our entry → popstate closes it
    else setOpen(null);
  };

  useEffect(() => {
    void load();
    const deep = Number(new URLSearchParams(window.location.search).get(key));
    if (deep) void show(deep, false);
    const onPop = () => {
      const uid = Number(new URLSearchParams(window.location.search).get(key));
      if (uid) void show(uid, false); else setOpen(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const when = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Detroit", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  if (open) return (
    <div className="space-y-3 text-sm">
      <button className="text-brand underline" onClick={close}>← Back to inbox</button>
      <div className="space-y-1">
        <h3 className="text-base font-bold">{open.subject}</h3>
        <p className="text-xs text-ink-soft">From {open.fromName ? `${open.fromName} <${open.from}>` : open.from} · {when(open.date)}</p>
      </div>
      {lead && <p className="rounded bg-brand-tint p-2 text-xs">Business lead: <a className="font-semibold text-brand underline" href={`/hub/biz-leads/${lead.id}`}>{lead.business_name ?? "open lead"}</a> · {lead.status}. The sales agent has read this reply too — check the lead for its summary and draft answer.</p>}
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-paper p-2 font-sans text-sm">{open.text}</pre>
      {open.from && <OfficeReply office={office} box={box} uid={open.uid} to={open.from} subject={open.subject} inReplyTo={open.messageId} references={open.references} />}
      {err && <p className="text-xs text-rose-700">{err}</p>}
    </div>
  );

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-3">
        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setCompose(!compose)}>{compose ? "Close" : "✏️ New email"}</button>
        <button className="text-xs text-brand underline" onClick={() => { setItems(null); void load(); }}>Refresh</button>
      </div>
      {compose && <OfficeCompose office={office} first={first} box={box} />}
      {err && <p className="text-xs text-rose-700">{err}</p>}
      {items === null ? <p className="text-ink-soft">Loading inbox…</p> : (
        <ul className="divide-y divide-line">
          {items.map((m) => (
            <li key={m.uid}>
              <button className="flex w-full flex-wrap justify-between gap-2 py-1.5 text-left hover:bg-paper" onClick={() => show(m.uid, true)} disabled={loading !== null}>
                <span className={m.seen ? "" : "font-semibold"}>{m.fromName ?? m.from} — {m.subject}</span>
                <span className="text-xs text-ink-soft">{loading === m.uid ? "Opening…" : when(m.date)}</span>
              </button>
            </li>
          ))}
          {!items.length && !err && <li className="py-1.5 text-ink-soft">Inbox is empty.</li>}
        </ul>
      )}
    </div>
  );
}

// ─── Mark's office (2026-11-24): one Email card, a tab per inbox (his own, business leads, info@) ───
export interface InboxTab { box: "office" | "leads" | "company" | "net"; label: string; email: string | null; connected: boolean; help: string; note?: string }

export function OfficeInboxes({ office, first, tabs }: { office: string; first: string; tabs: InboxTab[] }) {
  const pick = () => {
    try { const b = new URLSearchParams(window.location.search).get("inbox"); if (b && tabs.some((t) => t.box === b)) return b as InboxTab["box"]; } catch {}
    return (tabs.find((t) => t.connected) ?? tabs[0]).box;
  };
  const [box, setBox] = useState<InboxTab["box"]>(tabs[0].box);
  useEffect(() => { setBox(pick()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const t = tabs.find((x) => x.box === box) ?? tabs[0];
  const choose = (b: InboxTab["box"]) => {
    setBox(b);
    const u = new URL(window.location.href); u.searchParams.set("inbox", b); u.searchParams.delete("mail"); u.searchParams.delete("lead_mail"); u.searchParams.delete("info_mail"); u.searchParams.delete("net_mail");
    window.history.replaceState(window.history.state, "", u.toString());
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1 border-b border-line">
        {tabs.map((x) => (
          <button key={x.box} onClick={() => choose(x.box)}
            className={`-mb-px rounded-t border px-3 py-1.5 text-sm ${x.box === box ? "border-line border-b-white bg-white font-semibold" : "border-transparent text-ink-soft hover:text-ink"}`}>
            {x.label}{!x.connected && <span className="ml-1 text-xs text-amber-700">(not connected)</span>}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-soft">
        <span>{t.email ?? "no address set"}{t.note ? ` — ${t.note}` : ""}</span>
        {t.connected && <VerifyMailbox office={office} box={t.box} />}
      </div>
      {t.connected ? <OfficeMail key={t.box} office={office} first={first} box={t.box} /> : <p className="rounded bg-amber-50 p-2 text-sm">Not connected yet. {t.help}</p>}
    </div>
  );
}
