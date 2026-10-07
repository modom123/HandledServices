/*
 * FILE    : apps/web/components/LaunchBanner.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-07_0315 UTC
 * PURPOSE : The grand opening bar above the site header: before the start → when savings begin; during the promotion →
 *           "Save (up to) 20% on every booking" with a live countdown; after it ends → "Grand Opening — we're officially
 *           open" for 30 days. Settings: Hub → Website & promotions. "Up to" unless the full-discount option is on.
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { countdownParts, type LaunchPhase } from "@handled/core";

export function LaunchBanner({ phase, startsAt, endsAt, pct, full, es }: { phase: LaunchPhase; startsAt: string | null; endsAt: string | null; pct: number; full: boolean; es: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (phase === "off" || phase === "done") return null;
  const target = phase === "upcoming" ? startsAt : endsAt;
  const c = countdownParts(target && now ? new Date(target).getTime() - now : 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const save = `${full ? "" : es ? "hasta " : "up to "}${Math.round(pct * 100)}%`;
  const clock = now ? (
    <span className="inline-flex gap-1 font-mono tabular-nums">
      {[[c.days, es ? "d" : "d"], [c.hours, "h"], [c.minutes, "m"], [c.seconds, "s"]].map(([v, u]) => (
        <span key={String(u)} className="rounded bg-white/10 px-1.5 py-0.5 text-gold-light">{u === "d" ? v : pad(Number(v))}{u}</span>
      ))}
    </span>
  ) : null;
  return (
    <div className="bg-brand-deep text-white">
      <div className="wrap flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 py-2 text-center text-sm">
        {phase === "active" && (<>
          <span>🎉 <b className="text-gold-light">{es ? "Gran apertura:" : "Grand opening savings:"}</b> {es ? `ahorre ${save} en cada reserva` : `save ${save} on every booking`}</span>
          <span className="inline-flex items-center gap-2 text-white/75">{es ? "Termina en" : "Ends in"} {clock}</span>
          <Link href="/book" className="rounded-full bg-gold-light px-3 py-1 text-xs font-bold text-brand-deep hover:bg-white">{es ? "Reserve ahora" : "Book now"} →</Link>
        </>)}
        {phase === "upcoming" && (<>
          <span>🎉 <b className="text-gold-light">{es ? "Gran apertura muy pronto:" : "Grand opening savings coming:"}</b> {es ? `${save} de descuento en cada reserva` : `${save} off every booking`}</span>
          <span className="inline-flex items-center gap-2 text-white/75">{es ? "Comienza en" : "Starts in"} {clock}</span>
        </>)}
        {phase === "grand_opening" && (<>
          <span>🎊 <b className="text-gold-light">{es ? "¡Gran Apertura!" : "Grand Opening!"}</b> {es ? "Ya estamos oficialmente abiertos. Gracias por ayudarnos a empezar." : "We're officially open. Thank you for helping us launch."}</span>
          <Link href="/book" className="rounded-full bg-gold-light px-3 py-1 text-xs font-bold text-brand-deep hover:bg-white">{es ? "Reserve ahora" : "Book now"} →</Link>
        </>)}
      </div>
    </div>
  );
}
