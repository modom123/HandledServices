/*
 * FILE    : apps/web/components/AccountNotes.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_2141 UTC
 * PURPOSE : Account notes UI: AddNote (client — log a note, call, email, meeting or text; append-only) and Timeline
 *           (the full history, newest first: people's notes plus automated lead events).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type TimelineEntry = { at: string; kind: string; label: string; body: string | null; author: string | null; source: "note" | "event"; from?: string };

const KINDS: [string, string][] = [["note", "Note"], ["call", "Call"], ["email", "Email"], ["meeting", "Meeting"], ["text", "Text"]];
const ICON: Record<string, string> = { note: "📝", call: "📞", email: "✉️", meeting: "🤝", text: "💬", status: "🔖" };

export function AddNote({ subjectType, subjectId }: { subjectType: "biz_lead" | "business_account" | "talent_client"; subjectId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState("note");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap gap-1">{KINDS.map(([k, l]) => <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-full border px-3 py-1 text-xs ${kind === k ? "border-brand bg-brand-tint font-semibold" : "border-line"}`}>{ICON[k]} {l}</button>)}</div>
      <textarea className="input min-h-20" placeholder={kind === "call" ? "Who you spoke with, what they said, next step…" : kind === "meeting" ? "Who was there, what was decided, next step…" : "What happened, what they care about, next step…"} value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="flex items-center gap-2">
        <button className="btn-primary" disabled={busy || !body.trim()} onClick={async () => {
          setBusy(true); setMsg("");
          const r = await fetch("/api/hub/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject_type: subjectType, subject_id: subjectId, kind, body }) });
          const j = await r.json().catch(() => ({}));
          setBusy(false);
          if (r.ok && j.ok) { setBody(""); router.refresh(); } else setMsg(String(j.error ?? "Couldn't save"));
        }}>Add to history</button>
        <span className="text-xs text-ink-soft">Notes are permanent — to correct one, add a new note.</span>
        {msg && <span className="text-rose-700">{msg}</span>}
      </div>
    </div>
  );
}

export function Timeline({ items }: { items: TimelineEntry[] }) {
  if (!items.length) return <p className="text-sm text-ink-soft">No history yet. Add the first note above.</p>;
  return (
    <ol className="space-y-3 border-l border-line pl-4 text-sm">
      {items.map((it, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[22px] top-0.5 text-xs">{it.source === "note" ? ICON[it.kind] ?? "📝" : "•"}</span>
          <div className="text-xs text-ink-soft">{new Date(it.at).toLocaleString("en-US", { timeZone: "America/Detroit", dateStyle: "medium", timeStyle: "short" })} · <b className={it.source === "note" ? "text-ink" : ""}>{it.label}</b>{it.author ? ` · ${it.author}` : ""}{it.from ? ` · ${it.from}` : ""}</div>
          {it.body && <p className={`whitespace-pre-wrap ${it.source === "event" ? "text-ink-soft" : ""}`}>{it.body}</p>}
        </li>
      ))}
    </ol>
  );
}
