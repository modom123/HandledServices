/*
 * FILE    : apps/web/components/home/pro/HomeDoors.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-23_1430 UTC
 * PURPOSE : The four big doors at the top of the home page (both layouts), each opening its page: Services → /services,
 *           Become a Pro → the application form (/pros#apply), Become a Partner → the sign-up form (/partners#join),
 *           Handled Network → /network (every portal: customers, businesses, pros, partners and the Hub). Theme colors.
 * UPDATED : 2026-10-23_1500 UTC — owner: open the sign-up sections instead of scrolling the home page.
 * UPDATED : 2026-11-09_0130 UTC — shorter doors: icon beside the title, less padding.
 * UPDATED : 2026-11-09_0200 UTC — line icons instead of emoji.
 * UPDATED : 2026-11-09_0330 UTC — part of the Professional look (lib/theme.ts "pro"); the original look keeps components/home/*.
 */
import Link from "next/link";
import { Glyph } from "@/components/Glyph";

export function HomeDoors({ es, servicesCount }: { es: boolean; servicesCount: number }) {
  const doors = [
    { href: "/services", icon: "🧽", title: es ? "Servicios" : "Services", body: es ? `Los ${servicesCount} servicios, con precio al instante` : `All ${servicesCount} services, priced instantly`, cta: es ? "Ver servicios" : "See services" },
    { href: "/pros#apply", icon: "🧰", title: es ? "Hágase profesional" : "Become a Pro", body: es ? "Trabajos pagados, pago semanal, sin cuotas" : "Paid jobs, weekly pay, no lead fees", cta: es ? "Postularme" : "Apply now" },
    { href: "/partners#join", icon: "💸", title: es ? "Hágase socio" : "Become a Partner", body: es ? "Gane el 10% por cada cliente que envíe" : "Earn 10% on every customer you send", cta: es ? "Registrarme" : "Sign up" },
    { href: "/network", icon: "🌐", title: es ? "Red Handled" : "Handled Network", body: es ? "Su portal: clientes, empresas, profesionales, socios y equipo" : "Your portal: customers, businesses, pros, partners & team", cta: es ? "Entrar" : "Sign in" },
  ];
  return (
    <section className="wrap pb-8">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {doors.map((d) => (
          <Link key={d.href} href={d.href} className="group flex flex-col rounded-xl bg-brand-deep p-4 text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-xl">
            <span className="flex items-center gap-2.5"><Glyph icon={d.icon} size="sm" tone="gold" /><span className="text-base font-extrabold leading-tight sm:text-lg">{d.title}</span></span>
            <span className="mt-1.5 flex-1 text-xs text-white/75 sm:text-sm">{d.body}</span>
            <span className="mt-2 text-sm font-semibold text-gold-light group-hover:underline">{d.cta} →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
