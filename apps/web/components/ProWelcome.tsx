/*
 * FILE    : apps/web/components/ProWelcome.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-28_2300 UTC
 * PURPOSE : "Welcome to Handled" lesson question (pro portal). Pick an answer → POST /api/pro/orientation; a right
 *           answer finishes the lesson and moves on, a wrong one says try again (no limit, nothing is recorded).
 */
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function LessonQuiz({ lesson, question, options, es, nextHref, done }: { lesson: string; question: string; options: string[]; es: boolean; nextHref: string; done: boolean }) {
  const router = useRouter();
  const [pick, setPick] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "wrong" | "right">(done ? "right" : "idle");
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="card space-y-3 border-brand/40">
      <div className="font-semibold">{es ? "Pregunta" : "Question"}: {question}</div>
      <div className="space-y-2">
        {options.map((o, i) => (
          <label key={i} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${pick === i ? "border-brand bg-brand-tint" : "border-line"}`}>
            <input type="radio" name="answer" checked={pick === i} disabled={state === "busy" || state === "right"} onChange={() => { setPick(i); if (state === "wrong") setState("idle"); }} /> {o}
          </label>
        ))}
      </div>
      {state === "wrong" && <p className="text-sm text-rose-700">{es ? "No es correcto. Vuelva a leer los puntos de arriba e inténtelo otra vez." : "Not quite. Read the points above again and try another answer."}</p>}
      {err && <p className="text-sm text-rose-700">{err}</p>}
      {state === "right" ? (
        <div className="flex flex-wrap items-center gap-3"><span className="text-sm font-semibold text-brand-dark">✅ {es ? "¡Correcto! Lección terminada." : "Correct! Lesson done."}</span>
          <button className="btn-primary" onClick={() => { router.push(nextHref); router.refresh(); }}>{es ? "Continuar →" : "Continue →"}</button></div>
      ) : (
        <button className="btn-primary" disabled={pick === null || state === "busy"} onClick={async () => {
          setState("busy"); setErr(null);
          const r = await fetch("/api/pro/orientation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lesson, choice: pick }) });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) { setState("idle"); setErr(j.error ?? (es ? "No se pudo guardar. Inténtelo otra vez." : "Couldn't save. Try again.")); return; }
          setState(j.correct ? "right" : "wrong");
        }}>{state === "busy" ? (es ? "Revisando…" : "Checking…") : (es ? "Revisar respuesta" : "Check answer")}</button>
      )}
    </div>
  );
}

/** Refer & earn: accept the partner terms and get a partner code (POST /api/pro/refer). */
export function StartEarning({ es }: { es: boolean }) {
  const router = useRouter();
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />{es ? "Leí y acepto los términos del programa de referidos de arriba." : "I've read and agree to the referral partner terms above."}</label>
      <button className="btn-primary" disabled={!agree || busy} onClick={async () => {
        setBusy(true); setErr(null);
        const r = await fetch("/api/pro/refer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agree: true }) });
        const j = await r.json().catch(() => ({}));
        setBusy(false);
        if (!r.ok) { setErr(j.error ?? "Couldn't sign you up"); return; }
        router.refresh();
      }}>{busy ? (es ? "Un momento…" : "One moment…") : (es ? "Empezar a ganar" : "Start earning")}</button>
      {err && <p className="text-sm text-rose-700">{err}</p>}
    </div>
  );
}
