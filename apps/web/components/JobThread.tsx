/*
 * FILE    : apps/web/components/JobThread.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_1412 UTC — English / Spanish (locale prop).
 * PURPOSE : Live job messages between customer, pro and ops (Supabase realtime + RLS).
 */
"use client";

import { useEffect, useState } from "react";
import { browserClient } from "@/lib/supabase/browser";
import { PhotoPicker } from "./PhotoPicker";
import { t as tr, type Locale } from "@handled/core";

type Msg = { id: number; sender_role: string; body: string; created_at: string };

export function JobThread({ jobId, userId, as, initial, locale = "en" }: { jobId: string; userId: string; as: "customer" | "pro"; initial: Msg[]; locale?: Locale }) {
  const t = (s: string) => tr(locale, s);
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
      <div className="font-semibold">{t("Messages")}</div>
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm">
        {msgs.length === 0 && <p className="text-ink-soft">{t("No messages yet.")}</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${m.sender_role === as ? "ml-auto bg-brand text-white" : "bg-paper"}`}>
            <div className="text-[12px] uppercase opacity-60">{t(m.sender_role)}</div>{m.body}
          </div>
        ))}
      </div>
      <form onSubmit={send} className="mt-3 flex gap-2"><input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("Write a message…")} /><button className="btn-primary">{t("Send")}</button></form>
    </div>
  );
}

export function ReviewForm({ jobId, contractorId, locale = "en" }: { jobId: string; contractorId: string | null; locale?: Locale }) {
  const t = (s: string) => tr(locale, s);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  if (done) return <div className="card text-sm">{t("Thanks for the review!")} ⭐</div>;
  return (
    <form className="card space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      const { error } = await browserClient().from("reviews").insert({ job_id: jobId, contractor_id: contractorId, rating, comment: comment || null });
      if (!error) setDone(true);
    }}>
      <div className="font-semibold">{t("How did we do?")}</div>
      <div className="flex gap-1 text-2xl">{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} onClick={() => setRating(n)} className={n <= rating ? "" : "opacity-30"}>★</button>)}</div>
      <textarea className="input" placeholder={t("Optional comment")} value={comment} onChange={(e) => setComment(e.target.value)} />
      <button className="btn-primary">{t("Submit review")}</button>
    </form>
  );
}

export function PayNow({ jobId, amount, label = "", locale = "en" }: { jobId: string; amount: string; label?: string; locale?: Locale }) {
  const t = (s: string) => tr(locale, s);
  const [msg, setMsg] = useState("");
  return (
    <div className="card border-brand bg-brand-tint">
      <div className="font-semibold">{t("Pay")} {amount}{label ? ` ${label}` : ""}{label.startsWith("balance") || label.startsWith("saldo") ? "" : ` ${t("to lock in your pro")}`}</div>
      <p className="mt-1 text-sm text-ink-soft">{t("We dispatch as soon as it’s paid. Not right? Free redo or your money back within 30 days.")}</p>
      <button className="btn-primary mt-3" onClick={async () => {
        const r = await fetch(`/api/account/jobs/${jobId}/pay`, { method: "POST" });
        const j = await r.json();
        if (j.url) window.location.href = j.url; else setMsg(j.error ?? t("Couldn’t start payment"));
      }}>{t("Pay now")}</button>
      {msg && <p className="mt-2 text-sm text-rose-700">{msg}</p>}
    </div>
  );
}

/** Customer cancels. Free 24h+ before the arrival window; inside 24h the late fee applies. */
export function CancelBooking({ jobId, late, fee, paid, locale = "en" }: { jobId: string; late: boolean; fee: string; paid: boolean; locale?: Locale }) {
  const t = (s: string) => tr(locale, s);
  const es = locale === "es";
  const [step, setStep] = useState(0);
  const [msg, setMsg] = useState("");
  if (step === 0) return <button className="text-sm text-ink-soft underline" onClick={() => setStep(1)}>{t("Cancel this booking")}</button>;
  return (
    <div className="card border-rose-200 text-sm">
      <div className="font-semibold">{t("Cancel this booking?")}</div>
      <p className="mt-1 text-ink-soft">{!paid ? t("Nothing has been charged.") : late ? (es ? `Faltan menos de 24 horas para la llegada de su profesional, así que se retiene un cargo por cancelación tardía de ${fee} (le paga a su profesional el tiempo reservado). El resto se reembolsa a su tarjeta.` : `Your pro’s arrival window is less than 24 hours away, so a ${fee} late-cancellation fee is kept (it pays your pro for the reserved time). The rest is refunded to your card.`) : t("You’re more than 24 hours out — you’ll get a full refund to your card.")}</p>
      <div className="mt-3 flex gap-2">
        <button className="btn-primary bg-rose-600" onClick={async () => {
          const r = await fetch(`/api/account/jobs/${jobId}/cancel`, { method: "POST" });
          const j = await r.json().catch(() => ({}));
          if (r.ok) window.location.reload(); else setMsg(j.error ?? t("Couldn’t cancel"));
        }}>{t("Yes, cancel")}</button>
        <button className="btn-ghost" onClick={() => setStep(0)}>{t("Keep it")}</button>
      </div>
      {msg && <p className="mt-2 text-rose-700">{msg}</p>}
    </div>
  );
}

/** Add more photos to a booking (camera on phones, drag & drop / paste on desktop). */
export function AddJobPhotos({ jobId, count, locale = "en" }: { jobId: string; count: number; locale?: Locale }) {
  const t = (s: string) => tr(locale, s);
  const es = locale === "es";
  const [paths, setPaths] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="card">
      <div className="font-semibold">{t("Add photos for your pro")}</div>
      <p className="mt-1 text-sm text-ink-soft">{t("More angles, a close-up, the spot you’re worried about.")} {count ? `${count} ${t("on file.")}` : ""}</p>
      <div className="mt-3"><PhotoPicker value={paths} onChange={setPaths} max={Math.max(0, 12 - count)} onError={setMsg} locale={locale} /></div>
      {paths.length > 0 && (
        <button className="btn-primary mt-3" disabled={busy} onClick={async () => {
          setBusy(true);
          const r = await fetch(`/api/account/jobs/${jobId}/photos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paths }) });
          const j = await r.json().catch(() => ({}));
          setBusy(false);
          if (r.ok) window.location.reload(); else setMsg(j.error ?? t("Couldn’t add photos"));
        }}>{busy ? t("Saving…") : es ? `Agregar ${paths.length} foto${paths.length > 1 ? "s" : ""} a mi reserva` : `Add ${paths.length} photo${paths.length > 1 ? "s" : ""} to my booking`}</button>
      )}
      {msg && <p className="mt-2 text-sm text-rose-700">{msg}</p>}
    </div>
  );
}
