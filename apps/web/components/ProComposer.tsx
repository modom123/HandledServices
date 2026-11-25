"use client";
/*
 * FILE    : apps/web/components/ProComposer.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-25_1800 UTC
 * PURPOSE : The composer at the top of a pro's "Conversation & activity" panel: one switch between ✉️ Email (the
 *           candidate email box, reused) and 📝 Note (note / call / text / meeting, saved on the pro's history via
 *           POST /api/hub/recruiting { action: "note" }). Both land in the same timeline.
 * UPDATED : 2026-11-25_1830 UTC — applicants too (applicationId; contractorId may be null).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CandidateEmail } from "@/components/CandidateEmail";

const KINDS = [["note", "📝 Note"], ["call", "📞 Call"], ["text", "💬 Text"], ["meeting", "🤝 Meeting"]] as const;

export function ProComposer({ contractorId, applicationId = null, email, firstName, hasAccount, senders, phone }: { contractorId: string | null; applicationId?: string | null; email: string | null; firstName: string; hasAccount: boolean; senders: { id: string; label: string }[]; phone: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<"email" | "note">("note");
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>("note");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <div className="space-y-2 rounded-lg border border-line p-3">
      <div className="flex gap-1 text-sm">
        {(["note", "email"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-full px-3 py-1 ${mode === m ? "bg-brand text-white" : "bg-paper"}`}>{m === "note" ? "📝 Add a note" : "✉️ Email them"}</button>
        ))}
      </div>
      {mode === "email" ? (
        <CandidateEmail appId={applicationId} contractorId={contractorId} email={email} firstName={firstName} hasAccount={hasAccount} senders={senders} phone={phone} />
      ) : (
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-1">{KINDS.map(([k, l]) => <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-full border px-2.5 py-0.5 text-xs ${kind === k ? "border-brand bg-brand-tint" : "border-line"}`}>{l}</button>)}</div>
          <textarea className="input h-20" maxLength={950} placeholder={kind === "call" ? "What you talked about, what's next" : "Write a note (only staff see it)"} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex items-center gap-2">
            <button className="btn-primary" disabled={busy || !text.trim()} onClick={async () => {
              setBusy(true); setMsg("");
              const label = KINDS.find(([k]) => k === kind)![1].replace(/^\S+\s/, "");
              const r = await fetch("/api/hub/recruiting", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "note", contractor_id: contractorId ?? undefined, application_id: applicationId ?? undefined, note: kind === "note" ? text.trim() : `${label}: ${text.trim()}` }) }).catch(() => null);
              setBusy(false);
              if (r?.ok) { setText(""); setMsg("Saved."); router.refresh(); } else setMsg("Couldn't save");
            }}>Save</button>
            {msg && <span className="text-ink-soft">{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
