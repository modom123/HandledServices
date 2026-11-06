/*
 * FILE    : apps/web/components/home/PartnerBand.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-23_0430 UTC
 * PURPOSE : "Become a partner" band on the home page (both layouts): the Referral Partner Program (/partners) — share a link
 *           or send a customer, earn 10% of our fee on their jobs for 12 months, paid Mondays. Colors follow the theme.
 * UPDATED : 2026-10-23_1430 UTC — id="partner" so the home page's Become a Partner door scrolls here.
 * UPDATED : 2026-10-23_1500 UTC — the button opens the sign-up form (/partners#join).
 * UPDATED : 2026-11-06_1702 UTC — Partner Program: two ways to earn (direct sales + referrals), 10% rising to 45% of our profit.
 */
import Link from "next/link";

export function PartnerBand({ es }: { es: boolean }) {
  return (
    <section id="partner" className="wrap scroll-mt-24 py-10">
      <div className="relative overflow-hidden rounded-3xl bg-brand-deep px-6 py-10 text-white sm:px-10">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gold/25 blur-3xl" />
        <div className="relative grid items-center gap-6 md:grid-cols-[1.4fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gold-light ring-1 ring-white/20">💸 {es ? "Programa de socios" : "Partner Program"}</span>
            <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">{es ? "Hágase socio. Gane vendiendo o refiriendo." : "Become a partner. Get paid to sell or refer."}</h2>
            <p className="mt-3 max-w-xl text-white/80">{es ? "Dos formas de ganar: venda cualquier servicio con un ticket desde su teléfono (fotos, precio al instante, el cliente paga en el momento), o comparta su enlace o código. Empiece con el 10% de nuestra ganancia en cada trabajo y suba hasta el 45% a medida que crece. Pagado cada lunes. Medio tiempo o tiempo completo: usted elige sus horas." : "Two ways to earn: sell any service with a ticket from your phone (photos, instant price, the customer pays on the spot), or share your link or code. Start at 10% of our profit on every job and climb to 45% as you grow. Paid every Monday. A few hours a week or your main income: you set the hours."}</p>
            <div className="mt-4 grid max-w-xl gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/15"><b className="text-gold-light">{es ? "1 · Ventas directas" : "1 · Direct sales"}</b><br />{es ? "Usted vende, nosotros hacemos el trabajo." : "You sell it, we do the work."}</div>
              <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/15"><b className="text-gold-light">{es ? "2 · Referidos" : "2 · Referrals"}</b><br />{es ? "Usted los envía, nosotros vendemos." : "You send them, we sell it."}</div>
            </div>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <Link href="/partners#join" className="btn bg-white px-8 py-4 text-lg font-bold text-brand-deep shadow-lg hover:bg-gold-light">{es ? "Hacerme socio" : "Become a partner"} →</Link>
            <span className="text-sm text-white/70">{es ? "Gratis · 10% → 45% · pagos cada lunes" : "Free to join · 10% → 45% · paid every Monday"}</span>
            <Link href="/partners" className="text-sm font-semibold text-gold-light underline">{es ? "Cómo funciona" : "How it works"}</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
