/*
 * FILE    : apps/web/components/PayoutStep.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-11_2340 UTC
 * PURPOSE : Pro onboarding → "How you get paid". Replaces the old form (ACH / Stripe Connect / Check + "account last 4"),
 *           which didn't say what was needed or where to enter it. One way to get paid: direct deposit to the pro's bank
 *           through Stripe. It says exactly which numbers Stripe asks for, then sends the pro to Stripe's secure page to
 *           enter them (Handled never sees or stores them). No paper checks (owner, 2026-11-11).
 *           Opens Stripe setup
 *            (/api/pro/payouts/instant { setup, back: "onboarding" }); the step counts as done when the pro comes back and
 *           Stripe says the bank is ready (app/pro/onboarding ?connect=done). EN / ES.
 */
"use client";

import { useState } from "react";

export function PayoutStep({ method, bankConnected, es = false }: { method: string | null; bankConnected: boolean; es?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const save = async () => {
    setBusy(true); setMsg("");
    try {
      const s = await fetch("/api/pro/payouts/instant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setup: true, back: "onboarding" }) });
      const k = await s.json().catch(() => ({}));
      if (k.url) { window.location.href = k.url; return; }
      setMsg(String(k.error ?? (es ? "No pudimos abrir Stripe. Intente de nuevo." : "We couldn't open Stripe. Please try again.")));
    } catch {
      setMsg(es ? "No hay conexión. Intente de nuevo." : "No connection. Please try again.");
    } finally { setBusy(false); }
  };
  return (
    <div className="mt-3 space-y-3">
      {bankConnected && method === "stripe_connect" && <p className="rounded-lg bg-emerald-50 p-2 text-sm font-semibold text-emerald-800">✓ {es ? "Su banco está conectado. Le pagamos cada lunes por depósito directo." : "Your bank is connected. You're paid every Monday by direct deposit."}</p>}
      <div className="rounded-xl border border-line p-3 text-sm">
        <div className="font-semibold">{es ? "Depósito directo a su banco, a través de Stripe" : "Direct deposit to your bank, through Stripe"}</div>
        <p className="mt-1 text-ink-soft">{es ? "Se le paga cada lunes. En la página segura de Stripe tendrá que ingresar:" : "You're paid every Monday. On Stripe's secure page you'll enter:"}</p>
        <ul className="mt-1 list-disc pl-5 text-ink-soft">
          <li>{es ? "Número de ruta (routing) de su banco: 9 dígitos" : "Your bank's routing number: 9 digits"}</li>
          <li>{es ? "Número de cuenta: normalmente de 8 a 12 dígitos (hasta 17)" : "Your account number: usually 8–12 digits (up to 17)"}</li>
          <li>{es ? "Para confirmar que es usted: fecha de nacimiento y los últimos 4 dígitos de su Seguro Social (o el EIN de 9 dígitos de su negocio)" : "To confirm it's you: date of birth and the last 4 digits of your SSN (or your business's 9-digit EIN)"}</li>
        </ul>
        <p className="mt-1 text-ink-soft">{es ? "Los encuentra en un cheque o en la app de su banco. Handled nunca ve ni guarda sus números completos." : "You'll find them on a check or in your bank's app. Handled never sees or stores your full numbers."}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" disabled={busy} onClick={save}>
          {busy ? (es ? "Un momento…" : "One moment…") : bankConnected && method === "stripe_connect" ? (es ? "Cambiar mi banco en Stripe" : "Change my bank on Stripe") : (es ? "Continuar a Stripe para agregar mi banco" : "Continue to Stripe to add my bank")}
        </button>
        {msg && <span role="status" className="text-sm">{msg}</span>}
      </div>
    </div>
  );
}
