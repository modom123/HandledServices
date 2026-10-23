/*
 * FILE    : apps/web/components/home/HomeDoors.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-23_1430 UTC
 * PURPOSE : The four big doors at the top of the home page (both layouts): Services and Become a Partner jump to their
 *           sections further down the page (#services, #partner); Become a Pro opens /pros; Handled Network opens /network
 *           (every portal: customers, businesses, pros, partners and the Hub). Colors follow the theme.
 */
import Link from "next/link";

export function HomeDoors({ es, servicesCount }: { es: boolean; servicesCount: number }) {
  const doors = [
    { href: "#services", icon: "🧽", title: es ? "Servicios" : "Services", body: es ? `Los ${servicesCount} servicios, con precio al instante` : `All ${servicesCount} services, priced instantly` },
    { href: "/pros", icon: "🧰", title: es ? "Hágase profesional" : "Become a Pro", body: es ? "Trabajos pagados, pago semanal, sin cuotas" : "Paid jobs, weekly pay, no lead fees" },
    { href: "#partner", icon: "💸", title: es ? "Hágase socio" : "Become a Partner", body: es ? "Gane el 10% por cada cliente que envíe" : "Earn 10% on every customer you send" },
    { href: "/network", icon: "🌐", title: es ? "Red Handled" : "Handled Network", body: es ? "Su portal: clientes, empresas, profesionales, socios y equipo" : "Your portal: customers, businesses, pros, partners & team" },
  ];
  return (
    <section className="wrap pb-10">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {doors.map((d) => (
          <Link key={d.href} href={d.href} className="group flex flex-col rounded-2xl bg-brand-deep p-5 text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl sm:p-6">
            <span className="text-3xl sm:text-4xl">{d.icon}</span>
            <span className="mt-3 text-lg font-extrabold leading-tight sm:text-2xl">{d.title}</span>
            <span className="mt-1 flex-1 text-xs text-white/75 sm:text-sm">{d.body}</span>
            <span className="mt-3 text-sm font-semibold text-gold-light group-hover:underline">{d.href.startsWith("#") ? (es ? "Ver abajo ↓" : "See below ↓") : (es ? "Abrir →" : "Open →")}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
