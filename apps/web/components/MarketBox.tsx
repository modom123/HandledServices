/*
 * FILE    : apps/web/components/MarketBox.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0150 UTC
 * PURPOSE : Customer, while no pro has taken the job: pros' counter offers (accept one — only the
 *           difference is charged) and "raise your offer" (re-offered to pros at the higher pay).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money, t as tr, type Locale } from "@handled/core";

export interface Counter { id: string; who: string; rating: number; jobs: number; price: number; note: string | null }

export function MarketBox({ jobId, price, suggested, counters, locale = "en" }: { jobId: string; price: number; suggested: number | null; counters: Counter[]; locale?: Locale }) {
  const t = (s: string) => tr(locale, s);
  const es = locale === "es";
  const router = useRouter();
  const [raise, setRaise] = useState(String(Math.max(Math.round(price * 1.1), Math.round(suggested ?? 0))));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function go(body: Record<string, unknown>) {
    setBusy(true); setMsg("");
    const r = await fetch(`/api/account/jobs/${jobId}/raise`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (j.url) { window.location.href = j.url; return; }
    if (!r.ok) return setMsg(t(j.error ?? "Try again"));
    router.refresh();
  }
  return (
    <div className="card space-y-3 text-sm">
      <div className="font-semibold">{es ? "Buscando un profesional a su precio" : "Finding a pro at your price"} · {money(price)}</div>
      {counters.length > 0 && (
        <div className="space-y-2">
          <p className="text-ink-soft">{es ? "Estos profesionales ofrecieron hacerlo por un poco más. Acepte uno y el trabajo es suyo — solo cobramos la diferencia." : "These pros offered to do it for a bit more. Accept one and the job is theirs — we only charge the difference."}</p>
          {counters.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper p-3">
              <div><b>{c.who}</b> · {c.rating.toFixed(1)}★ · {c.jobs} {es ? "trabajos" : "jobs"}{c.note ? <div className="text-xs text-ink-soft">“{c.note}”</div> : null}</div>
              <button className="btn-primary px-3 py-1.5" disabled={busy} onClick={() => go({ counter_offer_id: c.id })}>{es ? `Aceptar ${money(c.price)}` : `Accept ${money(c.price)}`} <span className="opacity-80">(+{money(c.price - price)})</span></button>
            </div>
          ))}
        </div>
      )}
      <div>
        <div className="font-semibold">{t("Raise your offer")}</div>
        <p className="text-ink-soft">{es ? "Una oferta más alta se envía de nuevo a los profesionales con mejor pago. Solo paga la diferencia." : "A higher offer goes back out to pros at the higher pay. You only pay the difference."}{suggested && price < suggested ? (es ? ` Sugerido: ${money(suggested)}.` : ` Suggested: ${money(suggested)}.`) : ""}</p>
        <div className="mt-2 flex gap-2">
          <div className="flex flex-1 items-center gap-1"><span className="text-ink-soft">$</span><input className="input" inputMode="numeric" value={raise} onChange={(e) => setRaise(e.target.value.replace(/[^\d]/g, ""))} /></div>
          <button className="btn-ghost" disabled={busy || !(Number(raise) > price)} onClick={() => go({ price: Number(raise) })}>{es ? `Subir a ${money(Number(raise) || 0)}` : `Raise to ${money(Number(raise) || 0)}`}</button>
        </div>
      </div>
      {msg && <p className="text-rose-700">{msg}</p>}
    </div>
  );
}
