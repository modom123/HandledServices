/*
 * FILE    : apps/web/components/MaterialsCard.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-23_2200 UTC
 * PURPOSE : Pro job page: the Handled materials card (Stripe Issuing).
 *             MaterialsCard — accept the cardholder terms, get the card, show its number (Stripe's Issuing Elements: the
 *                             number goes from Stripe to the browser only), freeze it; where it works on this job
 *             CardReceipt   — the receipt photo for a card purchase (every swipe needs one)
 */
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { money, t as tr, type Locale } from "@handled/core";

type StripeJs = {
  createEphemeralKeyNonce: (o: { issuingCard: string }) => Promise<{ nonce?: string; error?: { message: string } }>;
  elements: () => { create: (type: string, o: Record<string, unknown>) => { mount: (el: HTMLElement) => void } };
};
declare global { interface Window { Stripe?: (key: string) => StripeJs } }

/** Stripe.js must load from js.stripe.com (PCI): added once, on demand. */
function loadStripeJs(): Promise<void> {
  if (window.Stripe) return Promise.resolve();
  return new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = "https://js.stripe.com/v3/";
    s.onload = () => ok();
    s.onerror = () => fail(new Error("Couldn't load Stripe"));
    document.head.appendChild(s);
  });
}

export function MaterialsCard({ enabled, card, termsAccepted, onThisJob, jobStarted, vendors, left, publishableKey, termsUrl, locale = "en" }: {
  enabled: boolean; card: { id: string; last4: string | null; status: string | null } | null; termsAccepted: boolean; onThisJob: boolean; jobStarted: boolean;
  vendors: string[]; left: number; publishableKey: string; termsUrl: string; locale?: Locale;
}) {
  const t = (s: string) => tr(locale, s);
  const es = locale === "es";
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [shown, setShown] = useState(false);
  const [agree, setAgree] = useState(false);
  const num = useRef<HTMLDivElement>(null), exp = useRef<HTMLDivElement>(null), cvc = useRef<HTMLDivElement>(null);
  if (!enabled) return null;

  async function act(action: string) {
    setBusy(true); setMsg("");
    const r = await fetch("/api/pro/materials-card", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && action === "accept_terms") {
      const c = await fetch("/api/pro/materials-card", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create" }) });
      const cj = await c.json().catch(() => ({}));
      if (!c.ok) setMsg(cj.error ?? t("Try again"));
    } else if (!r.ok) setMsg(j.error ?? t("Try again"));
    setBusy(false);
    router.refresh();
  }

  async function show() {
    setBusy(true); setMsg("");
    try {
      await loadStripeJs();
      const stripe = window.Stripe!(publishableKey);
      if (!card?.id) throw new Error(t("No card yet"));
      const cardId = card.id;
      const { nonce, error } = await stripe.createEphemeralKeyNonce({ issuingCard: cardId });
      if (!nonce) throw new Error(error?.message ?? "nonce");
      const k = await fetch("/api/pro/materials-card/key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nonce }) });
      const { secret } = (await k.json()) as { secret: string };
      const els = stripe.elements();
      const o = { issuingCard: cardId, nonce, ephemeralKeySecret: secret, style: { base: { fontSize: "16px", fontFamily: "ui-monospace, monospace" } } };
      els.create("issuingCardNumberDisplay", o).mount(num.current!);
      els.create("issuingCardExpiryDisplay", o).mount(exp.current!);
      els.create("issuingCardCvcDisplay", o).mount(cvc.current!);
      setShown(true);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t("Try again"));
    }
    setBusy(false);
  }

  return (
    <div className="card space-y-2 text-sm">
      <div className="font-semibold">💳 {es ? "Tarjeta de materiales de Handled" : "Handled materials card"}</div>
      {!card ? (
        <>
          <p className="text-xs text-ink-soft">{es
            ? "Compre los materiales del trabajo con nuestra tarjeta en proveedores aprobados: sin sacar dinero de su bolsillo y sin esperar reembolsos."
            : "Buy job materials with our card at approved vendors — no money out of your pocket, no waiting for reimbursement."}</p>
          {!termsAccepted && (
            <label className="flex items-start gap-2 text-xs">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>{es ? "Acepto los " : "I accept the "}<a href={termsUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand underline">{es ? "Términos de usuario autorizado" : "Authorized User Terms"}</a>{es ? " de la tarjeta y usarla solo para materiales de trabajos de Handled." : " for the card, and to use it only for Handled job materials."}</span>
            </label>
          )}
          <button className="btn-primary w-full" disabled={busy || (!termsAccepted && !agree)} onClick={() => act(termsAccepted ? "create" : "accept_terms")}>{busy ? t("Working…") : es ? "Obtener mi tarjeta" : "Get my card"}</button>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span>•••• {card.last4} · {card.status === "active" ? (es ? "activa" : "active") : (es ? "congelada" : "frozen")}</span>
            <button className="text-xs text-brand underline" disabled={busy} onClick={() => act(card.status === "active" ? "freeze" : "unfreeze")}>{card.status === "active" ? (es ? "Congelar" : "Freeze") : (es ? "Reactivar" : "Unfreeze")}</button>
          </div>
          <p className={`rounded-lg p-2 text-xs ${onThisJob ? "bg-brand-tint text-brand-dark" : "bg-paper-deep text-ink-soft"}`}>
            {onThisJob
              ? (es ? `Funciona en este trabajo ahora: hasta ${money(left)} en proveedores aprobados. Suba la foto de cada recibo abajo.` : `Working on this job now: up to ${money(left)} at approved vendors. Add a photo of every receipt below.`)
              : jobStarted ? (es ? "Esta tarjeta está asignada a otro trabajo en curso." : "This card is on another job in progress.") : (es ? "Funciona en cuanto toque “Comenzar trabajo”." : "Works as soon as you tap “Start job”.")}
          </p>
          {vendors.length > 0 && <p className="text-xs text-ink-soft"><b>{es ? "Proveedores aprobados:" : "Approved vendors:"}</b> {vendors.join(", ")}. {es ? "En otras tiendas se rechaza." : "It declines anywhere else."}</p>}
          <div className={shown ? "space-y-1 rounded-lg border border-line p-2" : "hidden"}>
            <div ref={num} /><div className="flex gap-4"><div ref={exp} /><div ref={cvc} /></div>
            <p className="text-xs text-ink-soft">{es ? "Agréguela a Apple Pay o Google Pay escribiendo el número en su app de cartera." : "Add it to Apple Pay or Google Pay by typing the number into your wallet app."}</p>
          </div>
          {!shown && card.status === "active" && <button className="btn-ghost w-full" disabled={busy || !publishableKey} onClick={show}>{busy ? t("Working…") : es ? "Mostrar número de tarjeta" : "Show card number"}</button>}
        </>
      )}
      {msg && <p className="text-xs text-rose-700">{msg}</p>}
    </div>
  );
}

/** Receipt photo for a materials-card purchase. */
export function CardReceipt({ jobId, expenseId, locale = "en" }: { jobId: string; expenseId: string; locale?: Locale }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const es = locale === "es";
  return (
    <label className={`cursor-pointer text-xs font-semibold text-brand underline ${busy ? "opacity-50" : ""}`}>
      {busy ? (es ? "Subiendo…" : "Uploading…") : (es ? "📷 Agregar recibo" : "📷 Add receipt")}
      <input type="file" accept="image/*,application/pdf" className="hidden" disabled={busy} onChange={async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setBusy(true);
        const fd = new FormData(); fd.append("file", f);
        await fetch(`/api/pro/jobs/${jobId}/expenses/${expenseId}`, { method: "POST", body: fd });
        setBusy(false);
        router.refresh();
      }} />
    </label>
  );
}
