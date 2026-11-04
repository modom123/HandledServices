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
 */
import Link from "next/link";
import { PARTNER_PROGRAM, tierPct } from "@handled/core";

export function PartnerBand({ es }: { es: boolean }) {
  return (
    <section id="partner" className="wrap scroll-mt-24 py-10">
      <div className="relative overflow-hidden rounded-3xl bg-brand-deep px-6 py-10 text-white sm:px-10">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gold/25 blur-3xl" />
        <div className="relative grid items-center gap-6 md:grid-cols-[1.4fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gold-light ring-1 ring-white/20">💸 {es ? "Programa de socios" : "Partner Program"}</span>
            <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">{es ? "Hágase socio. Gane por cada cliente que envíe." : "Become a partner. Get paid for every customer you send."}</h2>
            <p className="mt-3 max-w-xl text-white/80">{es ? `Comparta su enlace o envíenos un cliente y gane el ${tierPct("one_time")} de un trabajo único, el ${tierPct("repeat")} de los trabajos repetidos durante ${PARTNER_PROGRAM.months} meses o el ${tierPct("account")} de los trabajos de una cuenta de negocio, pagado cada lunes. Gratis para unirse, ideal para agentes inmobiliarios, administradores de propiedades, negocios locales y cualquiera con una red.` : `Share your link or send us a customer and earn ${tierPct("one_time")} of a one-time job, ${tierPct("repeat")} of repeat jobs for ${PARTNER_PROGRAM.months} months, or ${tierPct("account")} of a business account's jobs, paid every Monday. Free to join, great for realtors, property managers, local businesses and anyone with a network.`}</p>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <Link href="/partners#join" className="btn bg-white px-8 py-4 text-lg font-bold text-brand-deep shadow-lg hover:bg-gold-light">{es ? "Hacerme socio" : "Become a partner"} →</Link>
            <span className="text-sm text-white/70">{es ? "Gratis · pagos cada lunes" : "Free to join · paid every Monday"}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
