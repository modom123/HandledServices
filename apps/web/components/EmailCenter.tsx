/*
 * FILE    : apps/web/components/EmailCenter.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_0148 UTC
 * PURPOSE : Hub → Email Center controls: campaign editor with live preview, audience size, spam / law check,
 *           test send and launch (now or scheduled); campaign actions; sender settings and mailbox check;
 *           inbox reply and one-off compose; add to the do-not-email list.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EMAIL_AUDIENCES, EMAIL_LIMITS, lintCampaign, marketingFooter, mergeTags, renderEmailHtml, type EmailAudience } from "@handled/core";

async function call(body: Record<string, unknown>) {
  const r = await fetch("/api/hub/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok && j.ok !== false, data: j as Record<string, unknown> & { error?: string } };
}

export interface Draft { id?: string; name: string; subject: string; preheader: string; body: string; subject_es: string; body_es: string; audience: EmailAudience; custom_list: string; custom_consent: boolean }

const SAMPLE = { first_name: "Alex", company: "Sample Property Co.", city: "Detroit", email: "alex@example.com", book_url: "https://handledsvc.com/book", site_url: "https://handledsvc.com" };

export function CampaignEditor({ initial, me }: { initial: Draft; me: string }) {
  const router = useRouter();
  const [d, setD] = useState<Draft>(initial);
  const [lang, setLang] = useState<"en" | "es">("en");
  const [count, setCount] = useState<{ count: number; unsubscribed: number; es: number } | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [at, setAt] = useState("");
  const set = (k: keyof Draft, v: string | boolean) => setD((x) => ({ ...x, [k]: v }));
  const lint = useMemo(() => lintCampaign(d), [d]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await call({ action: "count", audience: d.audience, custom_list: d.audience === "custom" ? d.custom_list : null });
      if (r.ok) setCount(r.data as unknown as { count: number; unsubscribed: number; es: number });
    }, 500);
    return () => clearTimeout(t);
  }, [d.audience, d.custom_list]);

  const preview = useMemo(() => {
    const es = lang === "es";
    const body = mergeTags(es ? d.body_es : d.body, SAMPLE);
    return {
      subject: mergeTags(es ? d.subject_es : d.subject, SAMPLE),
      html: renderEmailHtml(body, { preheader: d.preheader, footer: marketingFooter(d.audience, "[your business address]", "https://…/unsubscribe", lang) }).html,
    };
  }, [d, lang]);

  async function save(): Promise<string | null> {
    setBusy(true); setMsg("");
    const r = await call({ action: "save", ...d, subject_es: d.subject_es || null, body_es: d.body_es || null, preheader: d.preheader || null });
    setBusy(false);
    if (!r.ok) { setMsg(r.data.error ?? "Couldn't save"); return null; }
    const id = String(r.data.id);
    if (!d.id) { setD((x) => ({ ...x, id })); router.replace(`/hub/email/${id}`); }
    setMsg("Saved");
    return id;
  }

  const tags = ["{{first_name|there}}", "{{company}}", "{{city}}", "{{book_url}}", "{{site_url}}"];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3 text-sm">
        <input className="input" placeholder="Campaign name (only you see it)" value={d.name} onChange={(e) => set("name", e.target.value)} />
        <label className="block font-semibold">Who gets it
          <select className="input mt-1" value={d.audience} onChange={(e) => set("audience", e.target.value)}>
            {(Object.keys(EMAIL_AUDIENCES) as EmailAudience[]).map((k) => <option key={k} value={k}>{EMAIL_AUDIENCES[k].label}</option>)}
          </select>
        </label>
        {EMAIL_AUDIENCES[d.audience].note && <p className="text-xs text-ink-soft">{EMAIL_AUDIENCES[d.audience].note}</p>}
        {d.audience === "custom" && (
          <div className="space-y-2">
            <textarea className="input h-28 font-mono text-xs" placeholder={"One per line:\nJane Doe <jane@example.com>\nbob@example.com"} value={d.custom_list} onChange={(e) => set("custom_list", e.target.value)} />
            <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={d.custom_consent} onChange={(e) => set("custom_consent", e.target.checked)} className="mt-0.5" /> Everyone on this list gave us permission to email them (no bought or scraped lists).</label>
          </div>
        )}
        <p className="rounded-lg bg-paper p-2 text-xs">{count ? <>Reaches <b>{count.count.toLocaleString()}</b> people{count.es ? ` (${count.es} get the Spanish version if you write one)` : ""}{count.unsubscribed ? ` · ${count.unsubscribed} unsubscribed, left out` : ""}.</> : "Counting…"}</p>
        <div className="flex gap-2">
          {(["en", "es"] as const).map((l) => <button key={l} className={`rounded-lg px-3 py-1 text-xs font-semibold ${lang === l ? "bg-brand text-white" : "border border-line"}`} onClick={() => setLang(l)}>{l === "en" ? "English" : "Español (optional)"}</button>)}
        </div>
        {lang === "en" ? <>
          <input className="input" placeholder="Subject" value={d.subject} onChange={(e) => set("subject", e.target.value)} />
          <input className="input" placeholder="Preview text (shows after the subject in the inbox)" value={d.preheader} onChange={(e) => set("preheader", e.target.value)} />
          <textarea className="input h-72 font-mono text-xs" value={d.body} onChange={(e) => set("body", e.target.value)} />
        </> : <>
          <input className="input" placeholder="Asunto" value={d.subject_es} onChange={(e) => set("subject_es", e.target.value)} />
          <textarea className="input h-72 font-mono text-xs" placeholder="Leave empty to send English to everyone." value={d.body_es} onChange={(e) => set("body_es", e.target.value)} />
        </>}
        <p className="text-xs text-ink-soft">Blank line = new paragraph · <code>**bold**</code> · <code>[Button text](https://…)</code> on its own line = a button · lines starting with • = a list · tags: {tags.map((t) => <code key={t} className="mr-1">{t}</code>)}. The unsubscribe link and your business address are added automatically.</p>
        {(lint.blockers.length > 0 || lint.warnings.length > 0) && (
          <ul className="space-y-1 text-xs">{lint.blockers.map((b) => <li key={b} className="text-rose-700">⛔ {b}</li>)}{lint.warnings.map((w) => <li key={w} className="text-amber-700">⚠️ {w}</li>)}</ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-ghost" disabled={busy || d.name.trim().length < 2} onClick={save}>Save draft</button>
          <button className="btn-ghost" disabled={busy || d.name.trim().length < 2} onClick={async () => { const id = await save(); if (!id) return; const r = await call({ action: "test", id }); setMsg(r.ok ? `Test sent to ${me}` : r.data.error ?? "Test failed"); }}>Send me a test</button>
        </div>
        <div className="card space-y-2 bg-paper">
          <div className="font-semibold">Send</div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-primary" disabled={busy || lint.blockers.length > 0 || !count?.count} onClick={async () => {
              if (!confirm(`Send "${d.subject}" to ${count?.count.toLocaleString()} people? It goes out in small batches over the next hours.`)) return;
              const id = await save(); if (!id) return;
              const r = await call({ action: "launch", id });
              if (r.ok) router.refresh(); else setMsg(r.data.error ?? "Couldn't launch");
            }}>Send now</button>
            <span className="text-ink-soft">or at</span>
            <input type="datetime-local" className="input w-auto" value={at} onChange={(e) => setAt(e.target.value)} />
            <button className="btn-ghost" disabled={busy || !at || lint.blockers.length > 0 || !count?.count} onClick={async () => {
              const id = await save(); if (!id) return;
              const r = await call({ action: "launch", id, at: new Date(at).toISOString() });
              if (r.ok) router.refresh(); else setMsg(r.data.error ?? "Couldn't schedule");
            }}>Schedule</button>
          </div>
          <p className="text-xs text-ink-soft">Sends {EMAIL_LIMITS.perRun}-ish every 10 minutes within your daily cap, so your mailbox stays in good standing. People who got another campaign in the last {EMAIL_LIMITS.minDaysBetween} days are skipped.</p>
        </div>
        {msg && <p className="font-semibold">{msg}</p>}
      </div>
      <div>
        <div className="mb-2 text-sm"><span className="text-ink-soft">Subject:</span> <b>{preview.subject || "—"}</b> <span className="text-xs text-ink-soft">(preview with sample details)</span></div>
        <iframe title="Preview" srcDoc={preview.html} className="h-[640px] w-full rounded-xl border border-line bg-white" />
      </div>
    </div>
  );
}

export function CampaignActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    const r = await call({ action, id, ...extra });
    if (!r.ok) return setMsg(r.data.error ?? "Failed");
    if (action === "duplicate") router.push(`/hub/email/${r.data.id}`); else if (action === "delete") router.push("/hub/email"); else router.refresh();
  };
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {["scheduled", "sending"].includes(status) && <button className="btn-ghost" onClick={() => act("pause")}>Pause</button>}
      {status === "paused" && <button className="btn-primary" onClick={() => act("launch")}>Resume</button>}
      {["scheduled", "sending", "paused"].includes(status) && <button className="btn-ghost" onClick={() => confirm("Cancel? Nobody left in the queue will get it.") && act("cancel")}>Cancel</button>}
      <button className="btn-ghost" onClick={() => act("duplicate")}>Duplicate</button>
      {status === "draft" && <button className="text-xs text-rose-700 underline" onClick={() => confirm("Delete this draft?") && act("delete")}>Delete draft</button>}
      {msg && <span className="text-rose-700">{msg}</span>}
    </div>
  );
}

export function EmailSettingsForm({ s }: { s: { from_name: string; reply_to: string | null; daily_cap: number; per_run: number } }) {
  const router = useRouter();
  const [f, setF] = useState({ ...s, reply_to: s.reply_to ?? "" });
  const [msg, setMsg] = useState("");
  const [check, setCheck] = useState<{ smtp: string; imap: string; dns: { domain: string | null; spf: boolean; dkim: boolean; dmarc: boolean; notes: string[] } } | null>(null);
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-1">From name <input className="input w-40" value={f.from_name} onChange={(e) => setF({ ...f, from_name: e.target.value })} /></label>
        <label className="flex items-center gap-1">Replies to <input className="input w-56" placeholder="(the mailbox itself)" value={f.reply_to} onChange={(e) => setF({ ...f, reply_to: e.target.value })} /></label>
        <label className="flex items-center gap-1">Daily cap <input className="input w-20" inputMode="numeric" value={f.daily_cap} onChange={(e) => setF({ ...f, daily_cap: Math.min(EMAIL_LIMITS.maxDailyCap, Number(e.target.value.replace(/\D/g, "")) || 1) })} /></label>
        <label className="flex items-center gap-1">Per 10 min <input className="input w-16" inputMode="numeric" value={f.per_run} onChange={(e) => setF({ ...f, per_run: Math.min(EMAIL_LIMITS.maxPerRun, Number(e.target.value.replace(/\D/g, "")) || 1) })} /></label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" onClick={async () => { const r = await call({ action: "settings", ...f, reply_to: f.reply_to || null }); setMsg(r.ok ? "Saved" : r.data.error ?? "Failed"); router.refresh(); }}>Save</button>
        <button className="btn-ghost" onClick={async () => { setMsg("Checking…"); const r = await call({ action: "verify" }); setMsg(""); if (r.ok) setCheck(r.data as never); else setMsg(r.data.error ?? "Failed"); }}>Check mailbox & domain</button>
        {msg && <span className="text-ink-soft">{msg}</span>}
      </div>
      {check && (
        <div className="rounded-lg bg-paper p-3 text-xs">
          <div>Sending (SMTP): {check.smtp === "ok" ? "✅ connected" : `❌ ${check.smtp}`}</div>
          <div>Inbox (IMAP): {check.imap === "ok" ? "✅ connected" : `❌ ${check.imap}`}</div>
          <div>{check.dns.domain}: SPF {check.dns.spf ? "✅" : "❌"} · DKIM {check.dns.dkim ? "✅" : "❌"} · DMARC {check.dns.dmarc ? "✅" : "❌"}</div>
          {check.dns.notes.map((n) => <div key={n} className="mt-1 text-amber-800">{n}</div>)}
        </div>
      )}
      <p className="text-xs text-ink-soft">Hostinger limits how many emails a mailbox sends per day (it depends on your plan). Keep the cap under it; new mailboxes should start low (100–200/day) and grow.</p>
    </div>
  );
}

export function ReplyBox({ uid, to, subject, inReplyTo, references }: { uid: number; to: string; subject: string; inReplyTo: string | null; references: string | null }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2 text-sm">
      <textarea className="input h-40" placeholder={`Reply to ${to}…`} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex items-center gap-2">
        <button className="btn-primary" disabled={busy || !text.trim()} onClick={async () => {
          setBusy(true); const r = await call({ action: "reply", uid, to, subject, text, in_reply_to: inReplyTo, references }); setBusy(false);
          if (r.ok) { setText(""); setMsg("Sent — a copy is in your Sent folder."); router.refresh(); } else setMsg(r.data.error ?? "Failed");
        }}>Send reply</button>
        {msg && <span className="text-ink-soft">{msg}</span>}
      </div>
    </div>
  );
}

export function ComposeBox() {
  const [f, setF] = useState({ to: "", subject: "", text: "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2 text-sm">
      <div className="grid gap-2 sm:grid-cols-2"><input className="input" placeholder="To" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /><input className="input" placeholder="Subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></div>
      <textarea className="input h-32" placeholder="Message (your name is added as the signature)" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
      <div className="flex items-center gap-2">
        <button className="btn-primary" disabled={busy || !f.to || !f.subject || !f.text} onClick={async () => {
          setBusy(true); const r = await call({ action: "compose", ...f }); setBusy(false);
          if (r.ok) { setF({ to: "", subject: "", text: "" }); setMsg("Sent."); } else setMsg(r.data.error ?? "Failed");
        }}>Send</button>
        {msg && <span className="text-ink-soft">{msg}</span>}
      </div>
      <p className="text-xs text-ink-soft">For one-to-one emails (a quote follow-up, a question). For anything sent to a group, use a campaign so unsubscribes are honored.</p>
    </div>
  );
}

export function OptoutForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <input className="input w-64" placeholder="someone@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button className="btn-ghost" disabled={!email.includes("@")} onClick={async () => { const r = await call({ action: "optout", email }); setMsg(r.ok ? "Added — they won't get marketing email." : r.data.error ?? "Failed"); setEmail(""); router.refresh(); }}>Don't email</button>
      {msg && <span className="text-ink-soft">{msg}</span>}
    </div>
  );
}
