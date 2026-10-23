/*
 * FILE    : apps/web/components/home/ProBand.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-23_1500 UTC
 * PURPOSE : "Become a Pro" band on the home page (both layouts), above the Partner Program band: recruiting pros is the
 *           supply side of the business, so it gets a full-width band near the top instead of one tile at the bottom.
 *           The share pros keep comes from the payout rule (earningsHeadline), so it never drifts from the real split.
 *           White card with a brand border so it reads differently from the deep-colored partner band below it.
 */
import Link from "next/link";
import { earningsHeadline } from "@handled/core";

export function ProBand({ es }: { es: boolean }) {
  const head = earningsHeadline();
  const points = es
    ? [`Se queda con ${head.keepLarge}–${head.keepSmall}% de cada trabajo`, "El cliente ya pagó: sin cobrar ni facturar", "Pago cada lunes, gratis", "Rechace cualquier oferta sin penalización"]
    : [`Keep ${head.keepLarge}–${head.keepSmall}% of every job`, "The customer has already paid: no chasing invoices", "Paid every Monday, free", "Pass on any offer, no penalty"];
  return (
    <section className="wrap pt-10">
      <div className="relative overflow-hidden rounded-3xl border-2 border-brand bg-white px-6 py-10 shadow-sm sm:px-10">
        <div aria-hidden className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
        <div className="relative grid items-center gap-6 md:grid-cols-[1.4fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-tint px-3 py-1 text-xs font-semibold text-brand-dark">🧰 {es ? "Estamos contratando profesionales" : "Now hiring pros"}</span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{es ? "Hágase Pro de Handled. Trabajos pagados, no clientes potenciales." : "Become a Handled Pro. Paid jobs, not leads."}</h2>
            <p className="mt-3 max-w-xl text-ink-soft">{es ? "Limpiadores, técnicos de mantenimiento, cuadrillas de jardinería, pintores, mudanzas, conductores y más: reciba trabajos prepagados en su zona en su teléfono. Sin cuotas por clientes potenciales, sin ofertas, sin facturas." : "Cleaners, handymen, lawn crews, painters, movers, drivers and more: get prepaid jobs in your area on your phone. No lead fees, no bidding, no invoices."}</p>
            <ul className="mt-4 grid gap-2 text-[15px] font-semibold sm:grid-cols-2">
              {points.map((p) => <li key={p} className="flex gap-2"><span className="text-brand">✓</span>{p}</li>)}
            </ul>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <Link href="/pros#apply" className="btn-primary px-8 py-4 text-lg font-bold shadow-lg">{es ? "Postúlese en 5 minutos" : "Apply in 5 minutes"} →</Link>
            <Link href="/pros#pay" className="text-sm font-semibold text-brand hover:text-brand-dark">{es ? "Vea cuánto puede ganar" : "See what you’d make"} →</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
