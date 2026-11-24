"use client";
/*
 * FILE    : apps/web/components/CandidateEmail.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-24_2000 UTC
 * PURPOSE : Hub → Recruiting → a candidate's file: "Email this candidate". Pick a starter (finish your setup, set up a
 *           call, a document we need) or write your own; optionally add what's left in their setup plus a one-click
 *           sign-in link straight to it; send from the company sender or a Front Office mailbox (replies land in that
 *           office's inbox). POST /api/hub/recruiting { action: "email" }. Logged on the history.
 * UPDATED : 2026-11-24_2100 UTC — interview invites: video (Zoom: the meeting is created on send and its link put in the email),
 *           phone, in person, a reminder and after-the-interview; Send waits until the [brackets] are filled in.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

type Sender = { id: string; label: string };

export function CandidateEmail({ appId, contractorId, email, firstName, hasAccount, senders, phone }: { appId: string | null; contractorId: string | null; email: string | null; firstName: string; hasAccount: boolean; senders: Sender[]; phone?: string | null }) {
  const router = useRouter();
  const hi = `Hi ${firstName || "there"},`;
  type Starter = { key: string; label: string; subject: string; body: string; steps: boolean; zoom?: boolean; group: "onboarding" | "interview" };
  const STARTERS: Starter[] = [
    { key: "setup", group: "onboarding", label: "Finish your setup", subject: "You're close: finish your Handled setup", steps: true,
      body: `${hi}\n\nYou're close to getting jobs with Handled. Below is exactly what's left, and the link takes you straight to it. Most people finish in about 15 minutes.\n\nAny questions, just reply to this email.` },
    { key: "call", group: "onboarding", label: "Set up a call", subject: "A quick call about joining Handled", steps: false,
      body: `${hi}\n\nThanks for applying to Handled. I'd like to set up a quick 15-minute call to talk about the work in your area and answer your questions.\n\nWhat day and time work best for you this week? Just reply with a couple of options.` },
    { key: "doc", group: "onboarding", label: "A document we need", subject: "One document we need for your Handled setup", steps: true,
      body: `${hi}\n\nWe need one more thing to finish your setup: [say which document, e.g. your certificate of insurance].\n\nYou can upload it right in your checklist with the link below.` },
    { key: "blank", group: "onboarding", label: "Blank", subject: "", steps: hasAccount, body: `${hi}\n\n` },
    // interview invites (2026-11-24)
    { key: "iv_zoom", group: "interview", label: "Video interview (Zoom)", subject: "Your Handled interview on Zoom", steps: false, zoom: true,
      body: `${hi}\n\nThanks for applying to Handled. We'd like to meet you on a short video interview: about 20 minutes on your experience, the work you want, and any questions you have about how Handled works.\n\n{{zoom}}\n\nThe link works from a phone or computer; no Zoom account needed. If the time doesn't work, just reply with a couple that do.` },
    { key: "iv_phone", group: "interview", label: "Phone interview", subject: "Your Handled phone interview", steps: false,
      body: `${hi}\n\nThanks for applying to Handled. We'd like to set up a short phone interview: about 15 minutes on your experience and the work you want.\n\nI'll call you on [day] at [time]${phone ? ` at ${phone}` : ""}. If that doesn't work, reply with a couple of times that do.` },
    { key: "iv_person", group: "interview", label: "In-person interview", subject: "Your Handled interview: [day] at [time]", steps: false,
      body: `${hi}\n\nThanks for applying to Handled. We'd like to meet you in person.\n\nWhen: [day] at [time] (about 30 minutes)\nWhere: [address]\n\nPlease bring a photo ID, and photos of recent work if you have them. If the time doesn't work, just reply with a couple that do.` },
    { key: "iv_remind", group: "interview", label: "Interview reminder", subject: "Reminder: your Handled interview [day] at [time]", steps: false,
      body: `${hi}\n\nJust a reminder about your interview with Handled on [day] at [time]. If anything has come up, reply and we'll find another time.\n\nLooking forward to it.` },
    { key: "iv_after", group: "interview", label: "After the interview", subject: "Thanks for talking with Handled", steps: true,
      body: `${hi}\n\nThanks for taking the time to talk with us. The next step is finishing your setup: below is what's left, and the link takes you straight to it.` },
  ];
  const [f, setF] = useState({ subject: "", body: "", steps: hasAccount, from: senders[0]?.id ?? "company" });
  // a Zoom interview: when, and how long (the meeting is created when you send)
  const nextSlot = () => { const d = new Date(Date.now() + 86400000); d.setHours(10, 0, 0, 0); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T10:00`; };
  const [zoom, setZoom] = useState<{ on: boolean; start: string; minutes: number }>({ on: false, start: nextSlot(), minutes: 30 });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!email) return <p className="text-sm text-ink-soft">No email address on file for this candidate.</p>;
  return (
    <div className="space-y-2 text-sm">
      {(["onboarding", "interview"] as const).map((g) => (
        <div key={g} className="flex flex-wrap items-center gap-1.5">
          <span className="w-24 text-xs text-ink-soft">{g === "onboarding" ? "Onboarding:" : "Interview:"}</span>
          {STARTERS.filter((s) => s.group === g).map((s) => (
            <button key={s.key} type="button" className="rounded-full border border-line px-2.5 py-0.5 text-xs hover:border-brand"
              onClick={() => { setF({ ...f, subject: s.subject, body: s.body, steps: s.steps && hasAccount }); setZoom({ ...zoom, on: Boolean(s.zoom) }); }}>{s.label}</button>
          ))}
        </div>
      ))}
      <p className="text-xs text-ink-soft">Fill in anything in [brackets] before sending. For the AI chat interview, use <b>Email the AI interview link</b> in the Interview section: it sends them their own link.</p>
      <div className="text-xs text-ink-soft">To: <b>{email}</b></div>
      <input className="input" placeholder="Subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
      <textarea className="input h-40" placeholder="Your message" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
      {zoom.on && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-paper p-2 text-xs">
          <span className="font-semibold">Zoom interview:</span>
          <input type="datetime-local" className="input w-auto py-1 text-xs" value={zoom.start} onChange={(e) => setZoom({ ...zoom, start: e.target.value })} />
          <select className="input w-auto py-1 text-xs" value={zoom.minutes} onChange={(e) => setZoom({ ...zoom, minutes: Number(e.target.value) })}>{[15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}</select>
          <span className="text-ink-soft">The meeting is created on your office&apos;s Zoom when you send, and its link goes where {"{{zoom}}"} is.</span>
          <button type="button" className="text-ink-soft underline" onClick={() => setZoom({ ...zoom, on: false })}>No Zoom</button>
        </div>
      )}
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
        <button className="btn-primary" disabled={busy || f.subject.trim().length < 2 || f.body.trim().length < 5 || /\[(day|time|address|say which)/i.test(f.subject + f.body)} onClick={async () => {
          setBusy(true); setMsg(null);
          const r = await fetch("/api/hub/recruiting", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "email", application_id: appId ?? undefined, contractor_id: contractorId ?? undefined, subject: f.subject, body: f.body, with_steps: f.steps && hasAccount, from: f.from, zoom: zoom.on ? { start: new Date(zoom.start).toISOString(), minutes: zoom.minutes } : null }) }).catch(() => null);
          const j = r ? await r.json().catch(() => ({})) : {};
          setBusy(false);
          if (r?.ok) { setMsg({ ok: true, text: `Sent to ${email}. It's in the history below.` }); setF({ ...f, subject: "", body: "" }); setZoom({ ...zoom, on: false }); router.refresh(); }
          else setMsg({ ok: false, text: String((j as { error?: string }).error ?? "Couldn't send") });
        }}>{busy ? "Sending…" : "Send email"}</button>
        {msg && <span className={msg.ok ? "text-emerald-800" : "text-rose-700"}>{msg.text}</span>}
      </div>
      {/\[(day|time|address|say which)/i.test(f.subject + f.body) && <p className="text-xs text-amber-800">Fill in the [brackets] first.</p>}
      {f.from !== "company" && <p className="text-xs text-ink-soft">Replies go to that mailbox: you&apos;ll see them in that Front Office inbox.</p>}
    </div>
  );
}
