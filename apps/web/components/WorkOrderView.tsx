/*
 * FILE    : apps/web/components/WorkOrderView.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2043 UTC
 * PURPOSE : The pro's work order (offer page + job sheet) and the Uber-style accept panel.
 * UPDATED : 2026-10-02_1440 UTC — Spanish (pro portal)
 * UPDATED : 2026-10-03_0150 UTC — counter offer ("Not enough? Name your pay").
 * UPDATED : 2026-10-05_0221 UTC — the job checklist (special instructions first) on every work order.
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { t as tr, type Locale, type WorkOrder } from "@handled/core";
import { ChecklistView } from "./Checklist";

export function WorkOrderView({ w, locale = "en", hideChecklist = false }: { w: WorkOrder; locale?: Locale; hideChecklist?: boolean }) {
  const t = (s: string) => tr(locale, s);
  return (
    <div className="space-y-4">
      <div className="card">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t("Where & when")}</div>
        <div className="mt-1 font-semibold">{w.where}</div>
        <div className="text-sm text-ink-soft">{w.when}</div>
        {w.customer && <div className="mt-2 text-sm">{t("Customer:")} <b>{w.customer.name}</b>{w.customer.company ? ` (${w.customer.company})` : ""} · {w.customer.phone}</div>}
      </div>
      <div className="card">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t("Scope")}</div>
        <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">{w.scope.map((s) => <li key={s.label}><span className="text-ink-soft">{s.label}:</span> {s.value}</li>)}</ul>
        <div className="mt-2 text-sm"><span className="text-ink-soft">{t("Included:")}</span> {w.includes.join(" · ")}</div>
        {w.customerNotes && <p className="mt-3 rounded-xl bg-paper p-3 text-sm">{t("Customer:")} “{w.customerNotes}”</p>}
        {w.instructions && <p className="mt-3 rounded-xl bg-brand-tint p-3 text-sm text-brand-dark"><b>{t("Customer requirements & access:")}</b> {w.instructions}</p>}
        <p className="mt-3 text-xs text-ink-soft">📷 {w.photos}</p>
      </div>
      {!hideChecklist && w.checklist && (
        <details className="card" open={w.checklist.sections.some((s) => s.id === "special")}>
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-ink-soft">✅ {locale === "es" ? w.checklist.title_es : w.checklist.title} ({w.checklist.sections.reduce((n, s) => n + s.items.length, 0)})</summary>
          <div className="mt-3"><ChecklistView checklist={w.checklist} es={locale === "es"} compact /></div>
        </details>
      )}
      <div className="card">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{locale === "es" ? `Condiciones del trabajo (orden de trabajo v${w.version})` : `Job terms (work order v${w.version})`}</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">{w.terms.map((x) => <li key={x}>{x}</li>)}</ul>
      </div>
    </div>
  );
}

function useCountdown(until: string) {
  const [left, setLeft] = useState(() => new Date(until).getTime() - Date.now());
  useEffect(() => { const t = setInterval(() => setLeft(new Date(until).getTime() - Date.now()), 1000); return () => clearInterval(t); }, [until]);
  const s = Math.max(0, Math.floor(left / 1000));
  return { done: s === 0, label: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` };
}

export function AcceptPanel({ offerId, payout, expiresAt, status, jobId, locale = "en", payoutAmount = 0, counter = null }: { offerId: string; payout: string; expiresAt: string; status: string; jobId: string; locale?: Locale; payoutAmount?: number; counter?: number | null }) {
  const t = (s: string) => tr(locale, s);
  const router = useRouter();
  const { done, label } = useCountdown(expiresAt);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [countering, setCountering] = useState(false);
  const [want, setWant] = useState(String(Math.round(payoutAmount * 1.15) || ""));
  const [why, setWhy] = useState("");
  async function sendCounter() {
    setBusy(true);
    const res = await fetch(`/api/pro/offers/${offerId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "counter", payout: Number(want), note: why }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !j.ok) return setMsg(t(j.error ?? "Not available"));
    router.refresh();
  }
  async function act(action: "accept" | "decline") {
    setBusy(true);
    const res = await fetch(`/api/pro/offers/${offerId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "accept" ? { action, accept_terms: true } : { action }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(t(j.error ?? "Not available"));
    router.push(action === "accept" ? `/pro/jobs/${jobId}` : "/pro");
  }
  if (status === "accepted") return <div className="card border-brand bg-brand-tint text-center font-semibold text-brand-dark">{t("✓ You accepted this job —")} <a className="underline" href={`/pro/jobs/${jobId}`}>{t("open job")}</a></div>;
  if (status === "countered") return <div className="card text-center text-sm">{locale === "es" ? `Envió una contraoferta${counter ? ` de ${counter.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}` : ""}. Si el cliente la acepta, el trabajo es suyo y le avisaremos.` : `You countered${counter ? ` at ${counter.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}` : ""}. If the customer accepts, the job is yours and we'll let you know.`}</div>;
  if (status !== "offered" || done) return <div className="card text-center text-ink-soft">{t(status === "declined" ? "This offer has been passed." : "This offer has expired or was taken by another pro.")}</div>;
  return (
    <div className="card sticky bottom-4 space-y-3 border-brand shadow-lg">
      <div className="flex items-end justify-between">
        <div><div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t("Your payout")}</div><div className="text-4xl font-extrabold text-brand-dark">{payout}</div></div>
        <div className="text-right"><div className="text-xs text-ink-soft">{t("Offer expires in")}</div><div className="font-mono text-2xl font-bold">{label}</div></div>
      </div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> {t("I agree to this work order and its job terms.")}</label>
      <div className="flex gap-2">
        <button className="btn-ghost flex-1 py-3" disabled={busy} onClick={() => act("decline")}>{t("Pass")}</button>
        <button className="btn-primary flex-[2] py-3 text-base" disabled={busy || !agree} onClick={() => act("accept")}>{busy ? "…" : t("Accept job")}</button>
      </div>
      <p className="text-xs text-ink-soft">{t("First pro to accept gets it. The exact address unlocks the moment you accept.")}</p>
      {payoutAmount > 0 && (!countering
        ? <button className="text-sm text-brand underline" onClick={() => setCountering(true)}>{t("Not enough? Name your pay")}</button>
        : <div className="space-y-2 rounded-xl bg-paper p-3 text-sm">
            <div className="font-semibold">{t("What would you do it for?")}</div>
            <div className="flex items-center gap-1"><span className="text-ink-soft">$</span><input className="input" inputMode="numeric" value={want} onChange={(e) => setWant(e.target.value.replace(/[^\d]/g, ""))} /></div>
            <input className="input" value={why} maxLength={500} onChange={(e) => setWhy(e.target.value)} placeholder={t("Why (optional) — e.g. the yard is bigger than listed")} />
            <button className="btn-ghost w-full" disabled={busy || !(Number(want) > payoutAmount)} onClick={sendCounter}>{t("Send counter to the customer")}</button>
            <p className="text-xs text-ink-soft">{t("The customer sees the price it makes and decides. Other pros can still accept the original offer meanwhile.")}</p>
          </div>)}
      {msg && <p className="text-sm text-rose-700">{msg}</p>}
    </div>
  );
}
