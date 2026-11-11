/*
 * FILE    : apps/web/components/home/HomeDoors.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-23_1430 UTC
 * PURPOSE : The four big doors at the top of the home page (both layouts), each opening its page: Services → /services,
 *           Become a Pro → the application form (/pros#apply), Become a Partner → the sign-up form (/partners#join),
 *           Handled Network → /network (every portal: customers, businesses, pros, partners and the Hub). Theme colors.
 * UPDATED : 2026-10-23_1500 UTC — owner: open the sign-up sections instead of scrolling the home page.
 * UPDATED : 2026-10-28_1730 UTC — partner door shows the current rate (up to 25%) from @handled/core, not a hard-coded 10%.
 * UPDATED : 2026-11-06_1730 UTC — Partner Program: two ways to earn — referrals (partner-v2 tiers) and direct sales (10% → 45% of our profit).
 * UPDATED : 2026-11-06_1800 UTC — partner-v4: referrals pay one rate on every job, 15% of the price rising to 30%.
 * UPDATED : 2026-11-07_0033 UTC — owner: a fifth door, Business & Technology → /technology, where the websites, operating systems and
 *           automation services are (they're no longer on the home page itself). Five across on wide screens; on phones it
 *           spans the full row under the other four.
 */
import Link from "next/link";
import { referralRange } from "@handled/core";

export function HomeDoors({ es, servicesCount }: { es: boolean; servicesCount: number }) {
  const doors = [
    { href: "/services", icon: "🧽", title: es ? "Servicios" : "Services", body: es ? `Los ${servicesCount} servicios, con precio al instante` : `All ${servicesCount} services, priced instantly`, cta: es ? "Ver servicios" : "See services" },
    { href: "/pros#apply", icon: "🧰", title: es ? "Hágase profesional" : "Become a Pro", body: es ? "Trabajos pagados, pago semanal, sin cuotas" : "Paid jobs, weekly pay, no lead fees", cta: es ? "Postularme" : "Apply now" },
    { href: "/partners#join", icon: "💸", title: es ? "Hágase socio" : "Become a Partner", body: es ? `Refiera (${referralRange()} del trabajo) o venda usted mismo (del 10% al 45% de la ganancia)` : `Refer (${referralRange()} of the job) or sell it yourself (10% up to 45% of profit)`, cta: es ? "Registrarme" : "Sign up" },
    { href: "/network", icon: "🌐", title: es ? "Red Handled" : "Handled Network", body: es ? "Su portal: clientes, empresas, profesionales, socios y equipo" : "Your portal: customers, businesses, pros, partners & team", cta: es ? "Entrar" : "Sign in" },
    { href: "/technology", icon: "💡", title: es ? "Negocios y tecnología" : "Business & Technology", body: es ? "Sitios web inteligentes, sistemas para negocios y automatización" : "Intelligent websites, business systems and automation", cta: es ? "Ver servicios de automatización" : "See automation services", wide: true },
  ];
  return (
    <section className="wrap pb-10">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {doors.map((d) => (
          <Link key={d.href} href={d.href} className={`group flex flex-col rounded-2xl ${"wide" in d ? "col-span-2 lg:col-span-1" : ""} bg-brand-deep p-5 text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl sm:p-6`}>
            <span className="text-3xl sm:text-4xl">{d.icon}</span>
            <span className="mt-3 text-lg font-extrabold leading-tight sm:text-2xl lg:text-xl">{d.title}</span>
            <span className="mt-1 flex-1 text-xs text-white/75 sm:text-sm">{d.body}</span>
            <span className="mt-3 text-sm font-semibold text-gold-light group-hover:underline">{d.cta} →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
