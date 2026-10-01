/*
 * FILE    : apps/web/components/JobThread.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Live job messages between customer, pro and ops (Supabase realtime + RLS).
 */
"use client";

import { useEffect, useState } from "react";
import { browserClient } from "@/lib/supabase/browser";

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
