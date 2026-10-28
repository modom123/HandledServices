/*
 * FILE    : apps/web/components/home/HomeDoors.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-23_1430 UTC
 * PURPOSE : The four big doors at the top of the home page (both layouts), each opening its page: Services → /services,
 *           Become a Pro → the application form (/pros#apply), Become a Partner → the sign-up form (/partners#join),
 *           Handled Network → /network (every portal: customers, businesses, pros, partners and the Hub). Theme colors.
 * UPDATED : 2026-10-23_1500 UTC — owner: open the sign-up sections instead of scrolling the home page.
 * UPDATED : 2026-10-28_1730 UTC — partner door shows the current rate (up to 25%) from @handled/core, not a hard-coded 10%.
 */
import Link from "next/link";
import { tierPct } from "@handled/core";

export function HomeDoors({ es, servicesCount }: { es: boolean; servicesCount: number }) {
  const doors = [
    { href: "/services", icon: "🧽", title: es ? "Servicios" : "Services", body: es ? `Los ${servicesCount} servicios, con precio al instante` : `All ${servicesCount} services, priced instantly`, cta: es ? "Ver servicios" : "See services" },
    { href: "/pros#apply", icon: "🧰", title: es ? "Hágase profesional" : "Become a Pro", body: es ? "Trabajos pagados, pago semanal, sin cuotas" : "Paid jobs, weekly pay, no lead fees", cta: es ? "Postularme" : "Apply now" },
    { href: "/partners#join", icon: "💸", title: es ? "Hágase socio" : "Become a Partner", body: es ? `Gane hasta el ${tierPct("one_time")} de cada trabajo que nos envíe` : `Earn up to ${tierPct("one_time")} of every job you send us`, cta: es ? "Registrarme" : "Sign up" },
    { href: "/network", icon: "🌐", title: es ? "Red Handled" : "Handled Network", body: es ? "Su portal: clientes, empresas, profesionales, socios y equipo" : "Your portal: customers, businesses, pros, partners & team", cta: es ? "Entrar" : "Sign in" },
  ];
  return (
    <section className="wrap pb-10">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {doors.map((d) => (
          <Link key={d.href} href={d.href} className="group flex flex-col rounded-2xl bg-brand-deep p-5 text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl sm:p-6">
            <span className="text-3xl sm:text-4xl">{d.icon}</span>
            <span className="mt-3 text-lg font-extrabold leading-tight sm:text-2xl">{d.title}</span>
            <span className="mt-1 flex-1 text-xs text-white/75 sm:text-sm">{d.body}</span>
            <span className="mt-3 text-sm font-semibold text-gold-light group-hover:underline">{d.cta} →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
