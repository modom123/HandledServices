"use client";
/*
 * FILE    : apps/web/components/CandidateEmail.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-24_2000 UTC
 * PURPOSE : Hub → Recruiting → a candidate's file: "Email this candidate". Pick a starter (finish your setup, set up a
 *           call, a document we need) or write your own; optionally add what's left in their setup plus a one-click
 *           sign-in link straight to it; send from the company sender or a Front Office mailbox (replies land in that
 *           office's inbox). POST /api/hub/recruiting { action: "email" }. Logged on the history.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

type Sender = { id: string; label: string };

export function CandidateEmail({ appId, contractorId, email, firstName, hasAccount, senders }: { appId: string | null; contractorId: string | null; email: string | null; firstName: string; hasAccount: boolean; senders: Sender[] }) {
  const router = useRouter();
  const hi = `Hi ${firstName || "there"},`;
  const STARTERS: { key: string; label: string; subject: string; body: string; steps: boolean }[] = [
    { key: "setup", label: "Finish your setup", subject: "You're close: finish your Handled setup", steps: true,
      body: `${hi}\n\nYou're close to getting jobs with Handled. Below is exactly what's left, and the link takes you straight to it. Most people finish in about 15 minutes.\n\nAny questions, just reply to this email.` },
    { key: "call", label: "Set up a call", subject: "A quick call about joining Handled", steps: false,
      body: `${hi}\n\nThanks for applying to Handled. I'd like to set up a quick 15-minute call to talk about the work in your area and answer your questions.\n\nWhat day and time work best for you this week? Just reply with a couple of options.` },
    { key: "doc", label: "A document we need", subject: "One document we need for your Handled setup", steps: true,
      body: `${hi}\n\nWe need one more thing to finish your setup: [say which document, e.g. your certificate of insurance].\n\nYou can upload it right in your checklist with the link below.` },
    { key: "blank", label: "Blank", subject: "", steps: hasAccount, body: `${hi}\n\n` },
  ];
  const [f, setF] = useState({ subject: "", body: "", steps: hasAccount, from: senders[0]?.id ?? "company" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!email) return <p className="text-sm text-ink-soft">No email address on file for this candidate.</p>;
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs text-ink-soft">Start from:</span>
        {STARTERS.map((s) => (
          <button key={s.key} type="button" className="rounded-full border border-line px-2.5 py-0.5 text-xs hover:border-brand"
            onClick={() => setF({ ...f, subject: s.subject, body: s.body, steps: s.steps && hasAccount })}>{s.label}</button>
        ))}
      </div>
      <div className="text-xs text-ink-soft">To: <b>{email}</b></div>
      <input className="input" placeholder="Subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
      <textarea className="input h-40" placeholder="Your message" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
      <label className={`flex items-start gap-2 text-xs ${hasAccount ? "" : "text-ink-soft"}`}>
        <input type="checkbox" className="mt-0.5" disabled={!hasAccount} checked={f.steps && hasAccount} onChange={(e) => setF({ ...f, steps: e.target.checked })} />
        <span>Add what&apos;s left in their setup and a one-click sign-in link straight to it{hasAccount ? "" : " (once they're invited and have a pro account)"}</span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs">From{" "}
          <select className="input mt-0 w-auto py-1 text-xs" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })}>
            {senders.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <button className="btn-primary" disabled={busy || f.subject.trim().length < 2 || f.body.trim().length < 5} onClick={async () => {
          setBusy(true); setMsg(null);
          const r = await fetch("/api/hub/recruiting", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "email", application_id: appId ?? undefined, contractor_id: contractorId ?? undefined, subject: f.subject, body: f.body, with_steps: f.steps && hasAccount, from: f.from }) }).catch(() => null);
          const j = r ? await r.json().catch(() => ({})) : {};
          setBusy(false);
          if (r?.ok) { setMsg({ ok: true, text: `Sent to ${email}. It's in the history below.` }); setF({ ...f, subject: "", body: "" }); router.refresh(); }
          else setMsg({ ok: false, text: String((j as { error?: string }).error ?? "Couldn't send") });
        }}>{busy ? "Sending…" : "Send email"}</button>
        {msg && <span className={msg.ok ? "text-emerald-800" : "text-rose-700"}>{msg.text}</span>}
      </div>
      {f.from !== "company" && <p className="text-xs text-ink-soft">Replies go to that mailbox: you&apos;ll see them in that Front Office inbox.</p>}
    </div>
  );
}
