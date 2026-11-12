/*
 * FILE    : apps/web/components/ProPin.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-13_0030 UTC
 * PURPOSE : The Pro PIN on the web (lib/pro-pin.ts, /api/pro/pin):
 *             ProPinGate — on an accepted job, in place of the address, customer and entry details until the pro
 *                          enters their PIN (or creates one); unlocks this device for 12 hours. "Forgot PIN" emails a link.
 *             ProPinForm — /pro/pin: change the PIN (current PIN) or set a new one from the emailed reset link.
 *           English / Spanish.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const post = async (body: object) => {
  const r = await fetch("/api/pro/pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const j = r ? await r.json().catch(() => ({})) : { error: "No connection" };
  return { ok: Boolean(r?.ok), error: String((j as { error?: string }).error ?? "") };
};

const pinInput = (value: string, set: (v: string) => void, label: string, autoFocus = false) => (
  <input className="input w-36 text-center font-mono text-lg tracking-[0.4em]" type="password" inputMode="numeric" autoComplete="off" maxLength={6} aria-label={label} placeholder="••••" autoFocus={autoFocus}
    value={value} onChange={(e) => set(e.target.value.replace(/\D/g, "").slice(0, 6))} />
);

export function ProPinGate({ hasPin, es, city }: { hasPin: boolean; es: boolean; city: string }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const L = (en: string, sp: string) => (es ? sp : en);
  const go = async () => {
    if (!hasPin && pin !== again) return setMsg(L("The two PINs don't match.", "Los dos PIN no coinciden."));
    setBusy(true); setMsg("");
    const r = await post(hasPin ? { action: "unlock", pin } : { action: "set", pin });
    setBusy(false);
    if (!r.ok) { setPin(""); return setMsg(r.error || L("Try again", "Intente de nuevo")); }
    router.refresh();
  };
  return (
    <div className="mt-2 rounded-xl border border-line bg-paper p-3 text-sm">
      <div className="font-semibold">🔒 {city} · {L("address and customer locked", "dirección y cliente bloqueados")}</div>
      <p className="mt-1 text-ink-soft">{hasPin
        ? L("Enter your Pro PIN to see the street address, the customer's contact and entry details on this device for 12 hours.", "Ingrese su PIN de profesional para ver la dirección, el contacto del cliente y los datos de entrada en este dispositivo por 12 horas.")
        : L("Create your Pro PIN (4–6 digits). It protects your customers' addresses if your phone is lost or shared. You'll enter it once every 12 hours on each device.", "Cree su PIN de profesional (4 a 6 dígitos). Protege las direcciones de sus clientes si pierde o presta su teléfono. Lo ingresará una vez cada 12 horas en cada dispositivo.")}</p>
      <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); go(); }}>
        {pinInput(pin, setPin, L("PIN", "PIN"), true)}
        {!hasPin && pinInput(again, setAgain, L("PIN again", "Repita el PIN"))}
        <button className="btn-primary px-4" disabled={busy || pin.length < 4 || (!hasPin && again.length < 4)}>{busy ? "…" : hasPin ? L("Unlock", "Desbloquear") : L("Create PIN", "Crear PIN")}</button>
        {hasPin && <button type="button" className="text-xs text-brand underline" onClick={async () => { const r = await post({ action: "forgot" }); setMsg(r.ok ? L("We emailed you a link to set a new PIN (30 minutes).", "Le enviamos un enlace por correo para crear un PIN nuevo (30 minutos).") : r.error); }}>{L("Forgot PIN?", "¿Olvidó su PIN?")}</button>}
      </form>
      {msg && <p className="mt-2 text-xs text-rose-700">{msg}</p>}
    </div>
  );
}

export function ProPinForm({ hasPin, resetToken, es }: { hasPin: boolean; resetToken: string | null; es: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  const L = (en: string, sp: string) => (es ? sp : en);
  const needCurrent = hasPin && !resetToken;
  if (done) return <p className="card text-sm text-brand-dark">✓ {L("Your new PIN is set, and this device is unlocked for 12 hours.", "Su nuevo PIN está listo y este dispositivo está desbloqueado por 12 horas.")}</p>;
  return (
    <form className="card space-y-3 text-sm" onSubmit={async (e) => {
      e.preventDefault();
      if (pin !== again) return setMsg(L("The two PINs don't match.", "Los dos PIN no coinciden."));
      const r = await post({ action: "set", pin, ...(needCurrent ? { current } : {}), ...(resetToken ? { reset: resetToken } : {}) });
      if (!r.ok) return setMsg(r.error || L("Try again", "Intente de nuevo"));
      setDone(true); router.refresh();
    }}>
      {needCurrent && <label className="block font-semibold">{L("Current PIN", "PIN actual")}<div className="mt-1">{pinInput(current, setCurrent, L("Current PIN", "PIN actual"), true)}</div></label>}
      <label className="block font-semibold">{L("New PIN (4–6 digits)", "PIN nuevo (4 a 6 dígitos)")}<div className="mt-1">{pinInput(pin, setPin, L("New PIN", "PIN nuevo"), !needCurrent)}</div></label>
      <label className="block font-semibold">{L("New PIN again", "Repita el PIN nuevo")}<div className="mt-1">{pinInput(again, setAgain, L("New PIN again", "Repita el PIN nuevo"))}</div></label>
      <button className="btn-primary" disabled={pin.length < 4 || again.length < 4 || (needCurrent && current.length < 4)}>{hasPin ? L("Change PIN", "Cambiar PIN") : L("Create PIN", "Crear PIN")}</button>
      {needCurrent && <button type="button" className="ml-3 text-xs text-brand underline" onClick={async () => { const r = await post({ action: "forgot" }); setMsg(r.ok ? L("We emailed you a reset link (30 minutes).", "Le enviamos un enlace por correo (30 minutos).") : r.error); }}>{L("Forgot PIN?", "¿Olvidó su PIN?")}</button>}
      {msg && <p className="text-xs text-rose-700">{msg}</p>}
    </form>
  );
}
