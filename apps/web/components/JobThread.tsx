/*
 * FILE    : apps/web/components/JobThread.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Live job messages between customer, pro and ops (Supabase realtime + RLS).
 */
"use client";

import { useEffect, useState } from "react";
import { browserClient } from "@/lib/supabase/browser";
import { PhotoPicker } from "./PhotoPicker";

type Msg = { id: number; sender_role: string; body: string; created_at: string };

export function JobThread({ jobId, userId, as, initial }: { jobId: string; userId: string; as: "customer" | "pro"; initial: Msg[] }) {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [text, setText] = useState("");

  useEffect(() => {
    const sb = browserClient();
    const ch = sb
      .channel(`job-${jobId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `job_id=eq.${jobId}` }, (p) =>
        setMsgs((m) => (m.some((x) => x.id === (p.new as Msg).id) ? m : [...m, p.new as Msg])),
      )
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [jobId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const { data } = await browserClient().from("messages").insert({ job_id: jobId, sender_id: userId, sender_role: as, body: text.trim() }).select().single();
    if (data) setMsgs((m) => (m.some((x) => x.id === data.id) ? m : [...m, data as Msg]));
    setText("");
  }

  return (
    <div className="card">
      <div className="font-semibold">Messages</div>
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm">
        {msgs.length === 0 && <p className="text-ink-soft">No messages yet.</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${m.sender_role === as ? "ml-auto bg-brand text-white" : "bg-paper"}`}>
            <div className="text-[10px] uppercase opacity-60">{m.sender_role}</div>{m.body}
          </div>
        ))}
      </div>
      <form onSubmit={send} className="mt-3 flex gap-2"><input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message…" /><button className="btn-primary">Send</button></form>
    </div>
  );
}

export function ReviewForm({ jobId, contractorId }: { jobId: string; contractorId: string | null }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  if (done) return <div className="card text-sm">Thanks for the review! ⭐</div>;
  return (
    <form className="card space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      const { error } = await browserClient().from("reviews").insert({ job_id: jobId, contractor_id: contractorId, rating, comment: comment || null });
      if (!error) setDone(true);
    }}>
      <div className="font-semibold">How did we do?</div>
      <div className="flex gap-1 text-2xl">{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} onClick={() => setRating(n)} className={n <= rating ? "" : "opacity-30"}>★</button>)}</div>
      <textarea className="input" placeholder="Optional comment" value={comment} onChange={(e) => setComment(e.target.value)} />
      <button className="btn-primary">Submit review</button>
    </form>
  );
}

export function PayNow({ jobId, amount, label = "" }: { jobId: string; amount: string; label?: string }) {
  const [msg, setMsg] = useState("");
  return (
    <div className="card border-brand bg-brand-tint">
      <div className="font-semibold">Pay {amount}{label ? ` ${label}` : ""}{label.startsWith("balance") ? "" : " to lock in your pro"}</div>
      <p className="mt-1 text-sm text-ink-soft">We dispatch as soon as it’s paid. Not right? Free redo or your money back within 30 days.</p>
      <button className="btn-primary mt-3" onClick={async () => {
        const r = await fetch(`/api/account/jobs/${jobId}/pay`, { method: "POST" });
        const j = await r.json();
        if (j.url) window.location.href = j.url; else setMsg(j.error ?? "Couldn’t start payment");
      }}>Pay now</button>
      {msg && <p className="mt-2 text-sm text-rose-700">{msg}</p>}
    </div>
  );
}

/** Customer cancels. Free 24h+ before the arrival window; inside 24h the late fee applies. */
export function CancelBooking({ jobId, late, fee, paid }: { jobId: string; late: boolean; fee: string; paid: boolean }) {
  const [step, setStep] = useState(0);
  const [msg, setMsg] = useState("");
  if (step === 0) return <button className="text-sm text-ink-soft underline" onClick={() => setStep(1)}>Cancel this booking</button>;
  return (
    <div className="card border-rose-200 text-sm">
      <div className="font-semibold">Cancel this booking?</div>
      <p className="mt-1 text-ink-soft">{!paid ? "Nothing has been charged." : late ? `Your pro’s arrival window is less than 24 hours away, so a ${fee} late-cancellation fee is kept (it pays your pro for the reserved time). The rest is refunded to your card.` : "You’re more than 24 hours out — you’ll get a full refund to your card."}</p>
      <div className="mt-3 flex gap-2">
        <button className="btn-primary bg-rose-600" onClick={async () => {
          const r = await fetch(`/api/account/jobs/${jobId}/cancel`, { method: "POST" });
          const j = await r.json().catch(() => ({}));
          if (r.ok) window.location.reload(); else setMsg(j.error ?? "Couldn’t cancel");
        }}>Yes, cancel</button>
        <button className="btn-ghost" onClick={() => setStep(0)}>Keep it</button>
      </div>
      {msg && <p className="mt-2 text-rose-700">{msg}</p>}
    </div>
  );
}

/** Add more photos to a booking (camera on phones, drag & drop / paste on desktop). */
export function AddJobPhotos({ jobId, count }: { jobId: string; count: number }) {
  const [paths, setPaths] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="card">
      <div className="font-semibold">Add photos for your pro</div>
      <p className="mt-1 text-sm text-ink-soft">More angles, a close-up, the spot you’re worried about. {count ? `${count} on file.` : ""}</p>
      <div className="mt-3"><PhotoPicker value={paths} onChange={setPaths} max={Math.max(0, 12 - count)} onError={setMsg} /></div>
      {paths.length > 0 && (
        <button className="btn-primary mt-3" disabled={busy} onClick={async () => {
          setBusy(true);
          const r = await fetch(`/api/account/jobs/${jobId}/photos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paths }) });
          const j = await r.json().catch(() => ({}));
          setBusy(false);
          if (r.ok) window.location.reload(); else setMsg(j.error ?? "Couldn’t add photos");
        }}>{busy ? "Saving…" : `Add ${paths.length} photo${paths.length > 1 ? "s" : ""} to my booking`}</button>
      )}
      {msg && <p className="mt-2 text-sm text-rose-700">{msg}</p>}
    </div>
  );
}
