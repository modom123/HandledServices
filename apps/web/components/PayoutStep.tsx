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
 * UPDATED : 2026-11-17_1900 UTC — three ways to get paid (owner, 2026-11-17): direct deposit to your bank account (free,
 *           recommended), PayPal (your PayPal email) or Venmo (your Venmo phone) — $1.50 per payout, sent every Monday
 *           through PayPal. Saved with /api/pro/onboarding (step payout). Cash App / Zelle aren't offered (no business API).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PAYOUT_RAILS, maskHandle, railOf, type PayoutRail } from "@handled/core";

export function PayoutStep({ method, handle, bankConnected, es = false }: { method: string | null; handle?: string | null; bankConnected: boolean; es?: boolean }) {
  const router = useRouter();
  const current = railOf(method);
  const [rail, setRail] = useState<PayoutRail>(method === "paypal" || method === "venmo" ? current : "stripe");
  const [value, setValue] = useState(current === rail && handle ? (rail === "venmo" ? handle.replace(/^\+1/, "") : handle) : "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const L = (en: string, sp: string) => (es ? sp : en);

  const openStripe = async () => {
    setBusy(true); setMsg("");
    try {
      // switching back to bank deposit from PayPal / Venmo
      if (method === "paypal" || method === "venmo") await save("stripe_connect", "");
      const s = await fetch("/api/pro/payouts/instant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setup: true, back: "onboarding" }) });
      const k = await s.json().catch(() => ({}));
      if (k.url) { window.location.href = k.url; return; }
      setMsg(String(k.error ?? L("We couldn't open Stripe. Please try again.", "No pudimos abrir Stripe. Intente de nuevo.")));
    } catch {
      setMsg(L("No connection. Please try again.", "No hay conexión. Intente de nuevo."));
    } finally { setBusy(false); }
  };

  async function save(m: "stripe_connect" | "paypal" | "venmo", h: string) {
    const fd = new FormData();
    fd.set("step", "payout"); fd.set("payout_method", m); if (h) fd.set("payout_handle", h);
    const r = await fetch("/api/pro/onboarding", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, error: String(j.error ?? "") };
  }

  const saveWallet = async () => {
    setBusy(true); setMsg("");
    const r = await save(rail as "paypal" | "venmo", value).catch(() => ({ ok: false, error: L("No connection. Please try again.", "No hay conexión. Intente de nuevo.") }));
    setBusy(false);
    if (!r.ok) return setMsg(r.error || L("Couldn't save — check the details and try again.", "No se pudo guardar: revise los datos e intente de nuevo."));
    setMsg(L(`✓ Saved. You'll be paid by ${PAYOUT_RAILS[rail].label} every Monday.`, `✓ Guardado. Le pagaremos por ${PAYOUT_RAILS[rail].labelEs} cada lunes.`));
    router.refresh();
  };

  return (
    <div className="mt-3 space-y-3">
      {current === "stripe" && bankConnected && <p className="rounded-lg bg-emerald-50 p-2 text-sm font-semibold text-emerald-800">✓ {L("Your bank is connected. You're paid every Monday by direct deposit.", "Su banco está conectado. Le pagamos cada lunes por depósito directo.")}</p>}
      {current !== "stripe" && handle && <p className="rounded-lg bg-emerald-50 p-2 text-sm font-semibold text-emerald-800">✓ {L(`You're paid by ${PAYOUT_RAILS[current].label} (${maskHandle(handle)}) every Monday — $1.50 per payout.`, `Le pagamos por ${PAYOUT_RAILS[current].labelEs} (${maskHandle(handle)}) cada lunes: $1.50 por pago.`)}</p>}

      <fieldset className="grid gap-2 sm:grid-cols-3" aria-label={L("How do you want to be paid?", "¿Cómo quiere recibir sus pagos?")}>
        {(Object.keys(PAYOUT_RAILS) as PayoutRail[]).map((k) => (
          <label key={k} className={`cursor-pointer rounded-xl border p-3 text-sm ${rail === k ? "border-brand bg-brand-tint" : "border-line hover:border-brand"}`}>
            <input type="radio" name="rail" className="sr-only" checked={rail === k} onChange={() => { setRail(k); setMsg(""); setValue(current === k && handle ? (k === "venmo" ? handle.replace(/^\+1/, "") : handle) : ""); }} />
            <div className="font-semibold">{es ? PAYOUT_RAILS[k].labelEs : PAYOUT_RAILS[k].label}{k === "stripe" && <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-800">{L("Free", "Gratis")}</span>}</div>
            <div className="text-xs text-ink-soft">{es ? PAYOUT_RAILS[k].arrivesEs : PAYOUT_RAILS[k].arrives}</div>
          </label>
        ))}
      </fieldset>

      {rail === "stripe" ? (
        <>
          <div className="rounded-xl border border-line p-3 text-sm">
            <div className="font-semibold">{L("Direct deposit to your bank account, through Stripe", "Depósito directo a su cuenta bancaria, a través de Stripe")}</div>
            <p className="mt-1 text-ink-soft">{L("Any US checking or savings account. On Stripe's secure page you'll enter:", "Cualquier cuenta de cheques o ahorros de EE. UU. En la página segura de Stripe tendrá que ingresar:")}</p>
            <ul className="mt-1 list-disc pl-5 text-ink-soft">
              <li>{L("Your bank's routing number: 9 digits", "Número de ruta (routing) de su banco: 9 dígitos")}</li>
              <li>{L("Your account number: usually 8–12 digits (up to 17)", "Número de cuenta: normalmente de 8 a 12 dígitos (hasta 17)")}</li>
              <li>{L("To confirm it's you: date of birth and the last 4 digits of your SSN (or your business's 9-digit EIN)", "Para confirmar que es usted: fecha de nacimiento y los últimos 4 dígitos de su Seguro Social (o el EIN de 9 dígitos de su negocio)")}</li>
            </ul>
            <p className="mt-1 text-ink-soft">{L("You'll find them on a check or in your bank's app. Handled never sees or stores your full numbers.", "Los encuentra en un cheque o en la app de su banco. Handled nunca ve ni guarda sus números completos.")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" disabled={busy} onClick={openStripe}>
              {busy ? L("One moment…", "Un momento…") : current === "stripe" && bankConnected ? L("Change my bank on Stripe", "Cambiar mi banco en Stripe") : L("Continue to Stripe to add my bank", "Continuar a Stripe para agregar mi banco")}
            </button>
            {msg && <span role="status" className="text-sm">{msg}</span>}
          </div>
        </>
      ) : (
        <div className="space-y-2 rounded-xl border border-line p-3 text-sm">
          <label className="block font-semibold">{rail === "venmo" ? L("The mobile number on your Venmo account", "El número de celular de su cuenta Venmo") : L("The email on your PayPal account", "El correo de su cuenta PayPal")}
            <input className="input mt-1" type={rail === "venmo" ? "tel" : "email"} inputMode={rail === "venmo" ? "tel" : "email"} autoComplete={rail === "venmo" ? "tel" : "email"} placeholder={rail === "venmo" ? "(313) 555-0142" : "you@example.com"} value={value} onChange={(e) => setValue(e.target.value)} />
          </label>
          <p className="text-xs text-ink-soft">{L(`$1.50 is taken from each payout (not each job). Every Monday we send your whole week in one ${PAYOUT_RAILS[rail].label} payment. Make sure it matches your ${PAYOUT_RAILS[rail].label} account exactly, or the money comes back and waits for the next payout. Direct deposit to your bank is free.`, `Se descuentan $1.50 de cada pago (no de cada trabajo). Cada lunes enviamos toda su semana en un solo pago de ${PAYOUT_RAILS[rail].labelEs}. Debe coincidir exactamente con su cuenta, o el dinero regresa y espera al siguiente pago. El depósito directo a su banco es gratis.`)}</p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" disabled={busy || !value.trim()} onClick={saveWallet}>{busy ? L("Saving…", "Guardando…") : L(`Get paid by ${PAYOUT_RAILS[rail].label}`, `Recibir pagos por ${PAYOUT_RAILS[rail].labelEs}`)}</button>
            {msg && <span role="status" className="text-sm">{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
