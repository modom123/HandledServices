/*
 * FILE    : apps/web/components/TextsInbox.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-12_0005 UTC
 * PURPOSE : Hub → Texts row actions (client): reply by text, mark handled / reopen, attach an unmatched text to a job.
 *           Also the "Text this person" box used on the Hub job page. Everything goes through /api/hub/texts.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function post(body: unknown) {
  const r = await fetch("/api/hub/texts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as { error?: string; ref?: string };
  return { ok: r.ok, j };
}

export function TextReply({ to, jobId, inboxId, handled, unmatched, compact = false }: { to: string; jobId: string | null; inboxId?: string; handled?: boolean; unmatched?: boolean; compact?: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState(""), [job, setJob] = useState(""), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const run = async (b: unknown, done: string | ((j: { ref?: string }) => string)) => {
    setBusy(true); setMsg("");
    const r = await post(b);
    setBusy(false); setMsg(r.ok ? (typeof done === "string" ? done : done(r.j)) : r.j.error ?? "Failed");
    if (r.ok) { setBody(""); router.refresh(); }
  };
  const btn = "rounded-lg border border-line px-2 py-1 text-xs font-semibold hover:border-brand disabled:opacity-50";
  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        <input className="input h-9 min-w-0 flex-1 py-0 text-sm" maxLength={600} placeholder={compact ? `Text ${to}…` : "Reply by text…"} value={body} onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && body.trim() && !busy) run({ action: "reply", to, body, job_id: jobId, inbox_id: inboxId ?? null }, "Sent"); }} />
        <button className={btn} disabled={busy || !body.trim()} onClick={() => run({ action: "reply", to, body, job_id: jobId, inbox_id: inboxId ?? null }, "Sent")}>Send</button>
      </div>
      {inboxId && (
        <div className="flex flex-wrap items-center gap-1">
          {handled ? <button className={btn} disabled={busy} onClick={() => run({ action: "reopen", id: inboxId }, "Reopened")}>Reopen</button>
            : <button className={btn} disabled={busy} onClick={() => run({ action: "handled", id: inboxId }, "Marked handled")}>Mark handled</button>}
          {unmatched && <>
            <input className="input h-8 w-28 py-0 text-xs" placeholder="H-1042" value={job} onChange={(e) => setJob(e.target.value)} />
            <button className={btn} disabled={busy || job.trim().length < 3} onClick={() => run({ action: "link", id: inboxId, job: job.trim() }, (j) => `Attached to ${j.ref}`)}>Attach to job</button>
          </>}
        </div>
      )}
      {msg && <p className="text-xs text-ink-soft">{msg}</p>}
    </div>
  );
}
