/*
 * FILE    : apps/web/app/(site)/network/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-23_1430 UTC
 * PURPOSE : Handled Network — the front door for everyone who works with Handled: customers, business accounts, pros,
 *           referral partners and the Handled team (the Hub). One card per role opens that portal (signed-out visitors
 *           are sent to sign in first by the portal itself), plus how to join. Signed-in visitors see their own portal first.
 *           English / Spanish.
 */
import Link from "next/link";
import { BRAND } from "@handled/core";
import { getLocale } from "@/lib/locale";
import { getViewer, isStaff } from "@/lib/auth";

export const metadata = { title: "Handled Network", description: "Sign in to your Handled portal: customers, businesses, pros, partners and the Handled team." };

export default async function Network() {
  const es = (await getLocale()) === "es";
  const v = await getViewer().catch(() => null);
  const doors = [
    { key: "customer", icon: "🏠", href: "/account", title: es ? "Clientes" : "Customers", body: es ? "Sus reservas, precios, mensajes con su profesional, fotos y facturas." : "Your bookings, prices, messages with your pro, photos and invoices.", cta: es ? "Mi cuenta" : "My account", join: { href: "/book", label: es ? "Reservar un servicio" : "Book a service" } },
    { key: "business", icon: "🏢", href: "/account/business", title: es ? "Empresas" : "Businesses", body: es ? "Todas sus ubicaciones, órdenes de trabajo y una factura mensual." : "Every location, work orders and one monthly invoice.", cta: es ? "Portal de empresa" : "Business portal", join: { href: "/business", label: es ? "Abrir una cuenta" : "Open an account" } },
    { key: "pro", icon: "🧰", href: "/pro", title: es ? "Profesionales" : "Pros", body: es ? "Ofertas de trabajo, su agenda, ganancias, documentos y recompensas." : "Job offers, your schedule, earnings, documents and rewards.", cta: es ? "Portal de profesionales" : "Pro portal", join: { href: "/pros", label: es ? "Hacerse profesional" : "Become a pro" } },
    { key: "partner", icon: "💸", href: "/partner", title: es ? "Socios" : "Partners", body: es ? "Su enlace para referir, clientes enviados y pagos de cada lunes." : "Your referral link, customers you sent and Monday payouts.", cta: es ? "Panel de socio" : "Partner dashboard", join: { href: "/partners", label: es ? "Hacerse socio" : "Become a partner" } },
    { key: "team", icon: "🛠️", href: "/hub", title: es ? "Equipo de Handled" : "Handled team", body: es ? "El Hub: trabajos, despacho, profesionales, reclutamiento, finanzas y la fuerza laboral de IA." : "The Hub: jobs, dispatch, pros, recruiting, finance and the AI workforce.", cta: es ? "Abrir el Hub" : "Open the Hub", join: null },
  ];
  const mine = !v ? null : isStaff(v) ? "team" : v.contractorId ? "pro" : "customer";
  const ordered = mine ? [...doors.filter((d) => d.key === mine), ...doors.filter((d) => d.key !== mine)] : doors;
  return (
    <div className="wrap py-12">
      <div className="max-w-2xl">
        <div className="text-xs font-bold uppercase tracking-widest text-brand">{es ? "Red Handled" : "Handled Network"}</div>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">{es ? `Todos los que trabajan con ${BRAND.name}, en un solo lugar.` : `Everyone who works with ${BRAND.name}, in one place.`}</h1>
        <p className="mt-3 text-lg text-ink-soft">{es ? "Elija su portal. Si no ha iniciado sesión, le enviamos un enlace de un clic a su correo." : "Pick your portal. If you're not signed in, we email you a one-click sign-in link."}</p>
        {v && <p className="mt-3 text-sm">{es ? "Sesión iniciada como" : "Signed in as"} <b>{v.email}</b></p>}
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ordered.map((d) => (
          <div key={d.key} className={`card flex flex-col ${d.key === mine ? "border-brand ring-2 ring-brand/30" : ""}`}>
            <div className="flex items-center justify-between"><span className="text-4xl">{d.icon}</span>{d.key === mine && <span className="rounded-full bg-brand-tint px-2 py-0.5 text-xs font-semibold text-brand-dark">{es ? "Su portal" : "Your portal"}</span>}</div>
            <div className="mt-3 text-xl font-bold">{d.title}</div>
            <p className="mt-1 flex-1 text-sm text-ink-soft">{d.body}</p>
            <div className="mt-4 flex flex-col items-start gap-2">
              <Link href={d.href} className="btn-primary px-5">{d.cta} →</Link>
              {d.join ? <Link href={d.join.href} className="text-sm font-semibold text-brand">{d.join.label}</Link> : <span className="text-sm text-ink-soft">{es ? "Solo personal" : "Staff only"}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
