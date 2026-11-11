/*
 * FILE    : apps/web/components/home/PartnerBand.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-23_0430 UTC
 * PURPOSE : "Become a partner" band on the home page (both layouts): the Referral Partner Program (/partners) — share a link
 *           or send a referral ticket, earn 25% of a one-time job / 10% of repeat jobs / 15% of an account's jobs, paid Mondays.
 *           Colors follow the theme.
 * UPDATED : 2026-10-23_1430 UTC — id="partner" so the home page's Become a Partner door scrolls here.
 * UPDATED : 2026-10-23_1500 UTC — the button opens the sign-up form (/partners#join).
 * UPDATED : 2026-10-28_0122 UTC — partner-v2 rates from @handled/core (same rate on every service).
 * UPDATED : 2026-11-06_1730 UTC — Partner Program: two ways to earn — referrals (partner-v2 tiers) and direct sales (10% → 45% of our profit).
 * UPDATED : 2026-11-06_1800 UTC — partner-v4: referrals pay one rate on every job, 15% of the price rising to 30%.
 */
import Link from "next/link";
import { PARTNER_PROGRAM, referralRange } from "@handled/core";

export function PartnerBand({ es }: { es: boolean }) {
  return (
    <section id="partner" className="wrap scroll-mt-24 py-10">
      <div className="relative overflow-hidden rounded-3xl bg-brand-deep px-6 py-10 text-white sm:px-10">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gold/25 blur-3xl" />
        <div className="relative grid items-center gap-6 md:grid-cols-[1.4fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gold-light ring-1 ring-white/20">💸 {es ? "Programa de socios" : "Partner Program"}</span>
            <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">{es ? "Hágase socio. Gane refiriendo o vendiendo." : "Become a partner. Get paid to refer or sell."}</h2>
            <p className="mt-3 max-w-xl text-white/80">{es ? `Comparta su enlace o envíenos un cliente y gane del ${referralRange()} de cada trabajo durante ${PARTNER_PROGRAM.months} meses, pagado cada lunes. Gratis para unirse, ideal para agentes inmobiliarios, administradores de propiedades, negocios locales y cualquiera con una red.` : `Share your link or send us a customer and earn ${referralRange()} of every job they book for ${PARTNER_PROGRAM.months} months, paid every Monday. Free to join, great for realtors, property managers, local businesses and anyone with a network.`}</p>
            <div className="mt-4 grid max-w-xl gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/15"><b className="text-gold-light">{es ? "1 · Referidos" : "1 · Referrals"}</b><br />{es ? `Usted los envía, nosotros vendemos: del ${referralRange()} del trabajo.` : `You send them, we sell it: ${referralRange()} of the job.`}</div>
              <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/15"><b className="text-gold-light">{es ? "2 · Ventas directas" : "2 · Direct sales"}</b><br />{es ? "Usted vende con un ticket y el cliente paga en el momento: del 10% al 45% de nuestra ganancia, medio tiempo o completo." : "You sell it on a ticket and the customer pays on the spot: 10% up to 45% of our profit. Part-time or full-time."}</div>
            </div>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <Link href="/partners#join" className="btn bg-white px-8 py-4 text-lg font-bold text-brand-deep shadow-lg hover:bg-gold-light">{es ? "Hacerme socio" : "Become a partner"} →</Link>
            <span className="text-sm text-white/70">{es ? "Gratis · pagos cada lunes" : "Free to join · paid every Monday"}</span>
            <Link href="/partners" className="text-sm font-semibold text-gold-light underline">{es ? "Cómo funciona" : "How it works"}</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
