/*
 * FILE    : apps/web/components/home/pro/PartnerBand.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-23_0430 UTC
 * PURPOSE : "Become a partner" band on the home page (both layouts): the Referral Partner Program (/partners) — share a link
 *           or send a customer, earn 10% of our fee on their jobs for 12 months, paid Mondays. Colors follow the theme.
 * UPDATED : 2026-10-23_1430 UTC — id="partner" so the home page's Become a Partner door scrolls here.
 * UPDATED : 2026-10-23_1500 UTC — the button opens the sign-up form (/partners#join).
 * UPDATED : 2026-11-09_0130 UTC — shorter band.
 * UPDATED : 2026-11-09_0200 UTC — no emoji in the badge; squarer corners.
 * UPDATED : 2026-11-09_0330 UTC — part of the Professional look (lib/theme.ts "pro"); the original look keeps components/home/*.
 * UPDATED : 2026-11-10_0100 UTC — synced with main: two ways to earn (referrals at the referral range, direct sales 10%–45% of profit).
 */
import Link from "next/link";
import { PARTNER_PROGRAM, referralRange } from "@handled/core";

export function PartnerBand({ es }: { es: boolean }) {
  return (
    <section id="partner" className="wrap scroll-mt-24 py-8">
      <div className="relative overflow-hidden rounded-2xl bg-brand-deep px-6 py-7 text-white sm:px-8">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gold/25 blur-3xl" />
        <div className="relative grid items-center gap-6 md:grid-cols-[1.4fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gold-light ring-1 ring-white/20">{es ? "Programa de socios" : "Partner Program"}</span>
            <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">{es ? "Hágase socio. Gane refiriendo o vendiendo." : "Become a partner. Get paid to refer or sell."}</h2>
            <p className="mt-2 max-w-xl text-white/80">{es ? `Comparta su enlace o envíenos un cliente y gane del ${referralRange()} de cada trabajo durante ${PARTNER_PROGRAM.months} meses, pagado cada lunes. Su tasa sube a medida que crece.` : `Share your link or send us a customer and earn ${referralRange()} of every job they book for ${PARTNER_PROGRAM.months} months, paid every Monday. Your rate climbs as you grow.`}</p>
            <div className="mt-4 grid max-w-xl gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-white/10 p-3 ring-1 ring-white/15"><b className="text-gold-light">{es ? "1 · Referidos" : "1 · Referrals"}</b><br />{es ? `Usted los envía, nosotros vendemos: del ${referralRange()} del trabajo.` : `You send them, we sell it: ${referralRange()} of the job.`}</div>
              <div className="rounded-lg bg-white/10 p-3 ring-1 ring-white/15"><b className="text-gold-light">{es ? "2 · Ventas directas" : "2 · Direct sales"}</b><br />{es ? "Usted vende con un ticket y el cliente paga en el momento: del 10% al 45% de nuestra ganancia." : "You sell it on a ticket and the customer pays on the spot: 10% up to 45% of our profit."}</div>
            </div>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <Link href="/partners#join" className="btn bg-white px-6 py-3 text-base font-bold text-brand-deep shadow-lg hover:bg-gold-light">{es ? "Hacerme socio" : "Become a partner"} →</Link>
            <span className="text-sm text-white/70">{es ? "Gratis · pagos cada lunes" : "Free to join · paid every Monday"}</span>
            <Link href="/partners" className="text-sm font-semibold text-gold-light underline">{es ? "Cómo funciona" : "How it works"}</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
