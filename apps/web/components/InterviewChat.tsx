/*
 * FILE    : apps/web/components/InterviewChat.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_0246 UTC
 * PURPOSE : The candidate's AI screening interview: a clear AI disclosure and consent first (a person reviews
 *           and decides; they can ask for a person instead), then a simple chat. English / Spanish. Works on phones.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { BRAND } from "@handled/core";

type Line = { role: "ai" | "candidate"; text: string; at: string };

export function InterviewChat({ token, initial }: { token: string; initial: { status: string; locale: "en" | "es"; transcript: Line[]; firstName: string } }) {
  const [lang, setLang] = useState<"en" | "es">(initial.locale);
  const es = lang === "es";
  const [status, setStatus] = useState(initial.status);
  const [lines, setLines] = useState<Line[]>(initial.transcript);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [agree, setAgree] = useState(false);
  const [msg, setMsg] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [lines, busy]);

  async function post(body: Record<string, unknown>) {
    setBusy(true); setMsg("");
    const r = await fetch(`/api/interview/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok || j.ok === false) { setMsg(String(j.error ?? (es ? "Intente de nuevo" : "Try again"))); return null; }
    return j;
  }

  if (["expired", "cancelled"].includes(status)) return <div className="card">{es ? "Este enlace ya no está activo. Responda al correo y le enviaremos uno nuevo." : "This link is no longer active. Reply to our email and we'll send a new one."}</div>;
  if (status === "human_requested") return <div className="card">{es ? "Listo: una persona de nuestro equipo le contactará para la entrevista." : "Done — a person on our team will contact you for the interview."}</div>;

  if (status === "invited") return (
    <div className="card space-y-4">
      <div className="flex justify-end text-sm"><button className="underline" onClick={() => setLang(es ? "en" : "es")}>{es ? "English" : "Español"}</button></div>
      <h1 className="text-2xl font-bold">{es ? `Entrevista con ${BRAND.name}` : `Your ${BRAND.name} interview`}</h1>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {(es ? [
          "Unas 15 preguntas por chat sobre su experiencia, cómo cuida la calidad y cómo trata a los clientes. Unos 15 minutos.",
          "La conduce un asistente de inteligencia artificial (IA). La IA no toma la decisión: una persona de nuestro equipo revisa cada entrevista y decide.",
          "Guardamos lo que escriba para esa revisión. Solo se evalúan sus respuestas sobre el trabajo; la ortografía y el idioma no cuentan.",
          "Puede pausar y volver con el mismo enlace, y contestar en inglés o en español.",
        ] : [
          "About 15 chat questions about your experience, your quality standards and how you treat customers. About 15 minutes.",
          "It's run by an artificial intelligence (AI) assistant. The AI doesn't decide: a person on our team reviews every interview and makes the decision.",
          "We keep what you type for that review. Only your answers about the work are scored — spelling and language don't count.",
          "You can pause and come back with the same link, and answer in English or Spanish.",
        ]).map((x) => <li key={x}>{x}</li>)}
      </ul>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> {es ? "Entiendo que la entrevista la conduce una IA y que una persona revisa y decide. Acepto continuar." : "I understand the interview is run by an AI and a person reviews it and decides. I agree to continue."}</label>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={!agree || busy} onClick={async () => { const j = await post({ action: "consent", locale: lang }); if (j) { setStatus("in_progress"); setLines(j.transcript ?? []); } }}>{es ? "Empezar" : "Start"}</button>
        <button className="btn-ghost" disabled={busy} onClick={async () => { const j = await post({ action: "person" }); if (j) setStatus("human_requested"); }}>{es ? "Prefiero hablar con una persona" : "I'd rather talk to a person"}</button>
      </div>
      <p className="text-xs text-ink-soft">{es ? "¿Necesita un ajuste para hacer la entrevista (por ejemplo, por teléfono o con más tiempo)? Elija hablar con una persona." : "Need an accommodation (for example by phone, or more time)? Choose to talk to a person."}</p>
      {msg && <p className="text-sm text-rose-700">{msg}</p>}
    </div>
  );

  const finished = status === "completed" || (lines.length > 0 && busy === false && status !== "in_progress");
  return (
    <div className="card flex h-[75vh] flex-col p-0">
      <div className="border-b border-line p-3 text-sm font-semibold">🤖 {es ? `Asistente de IA de ${BRAND.name}` : `${BRAND.name} AI assistant`} <span className="font-normal text-ink-soft">· {es ? "una persona revisa y decide" : "a person reviews and decides"}</span></div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {lines.map((l, i) => (
          <div key={i} className={`flex ${l.role === "candidate" ? "justify-end" : ""}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${l.role === "candidate" ? "bg-brand text-white" : "bg-paper"}`}>{l.text}</div>
          </div>
        ))}
        {busy && <div className="text-sm text-ink-soft">…</div>}
        <div ref={end} />
      </div>
      {status === "in_progress" && !finished ? (
        <form className="flex gap-2 border-t border-line p-3" onSubmit={async (e) => {
          e.preventDefault();
          const t = text.trim(); if (!t || busy) return;
          setLines((x) => [...x, { role: "candidate", text: t, at: new Date().toISOString() }]); setText("");
          const j = await post({ action: "message", text: t });
          if (j) { setLines(j.transcript ?? []); if (j.done) setStatus("completed"); }
        }}>
          <textarea className="input min-h-[44px] flex-1" rows={2} placeholder={es ? "Escriba su respuesta…" : "Type your answer…"} value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement).requestSubmit(); } }} />
          <button className="btn-primary" disabled={busy || !text.trim()}>{es ? "Enviar" : "Send"}</button>
        </form>
      ) : <div className="border-t border-line p-3 text-sm">{es ? "Entrevista terminada. ¡Gracias! Le escribiremos por correo." : "Interview finished — thank you! We'll email you."}</div>}
      {msg && <p className="p-2 text-sm text-rose-700">{msg}</p>}
    </div>
  );
}
