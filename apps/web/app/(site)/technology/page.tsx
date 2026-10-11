/*
 * FILE    : apps/web/app/(site)/technology/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-11_2307 UTC
 * PURPOSE : /technology — "We build intelligent websites, business operating systems and automated businesses." The three
 *           pillars, how an engagement works, what Handled itself runs on (the proof), the rest of the Business & Technology
 *           services, and the free consultation. English / Spanish.
 */
import Link from "next/link";
import { SERVICES, priceHint, serviceText } from "@handled/core";
import { getLocale } from "@/lib/locale";
import { WeBuild } from "@/components/home/WeBuild";

export const metadata = {
  title: "Intelligent websites, business operating systems & automated businesses",
  description: "Handled builds intelligent websites, business operating systems and automated businesses — AI agents and automations included. Free video consultation.",
};

export default async function Technology() {
  const es = (await getLocale()) === "es";
  const others = SERVICES.filter((s) => s.category === "business" && !["website-design", "business-operating-system", "automated-business"].includes(s.slug));
  const steps = es
    ? [["1", "Consulta gratis por video", "Revisamos cómo funciona su negocio hoy y qué automatizar primero. Precio firme por escrito."], ["2", "Lo construimos", "Diseño, sistema, agentes de IA y automatizaciones, probados con usted antes de activarlos."], ["3", "Lanzamiento y capacitación", "Su equipo aprende en una sesión grabada. Usted es dueño de todo: datos, cuentas y accesos."], ["4", "Seguimiento", "Ajustamos durante las primeras semanas y le mostramos lo que hizo la IA, con una persona cuando hace falta."]]
    : [["1", "Free video consultation", "We look at how your business runs today and what to automate first. Firm price in writing."], ["2", "We build it", "Design, system, AI agents and automations — tested with you before anything goes live."], ["3", "Launch & training", "Your team learns it in one recorded session. You own everything: data, accounts and logins."], ["4", "We stay with you", "We tune it through the first weeks and show you what the AI did — with a person whenever it matters."]];
  const proof = es
    ? ["Reservas y precios al instante en el sitio, de día y de noche", "Despacho automático a profesionales verificados, con respaldos", "Pagos, facturas y pagos a profesionales sin hojas de cálculo", "Agentes de IA para atención al cliente, reclutamiento y operaciones, con aprobación humana en lo importante"]
    : ["Instant prices and booking on the website, day and night", "Automatic dispatch to vetted pros, with backups lined up", "Payments, invoices and pro payouts without spreadsheets", "AI agents for customer care, recruiting and operations — with a human approving what matters"];
  return (
    <div className="wrap space-y-14 py-14">
      <div className="max-w-3xl">
        <h1 className="text-4xl font-extrabold tracking-tight">{es ? "Creamos sitios web inteligentes, sistemas operativos para negocios y negocios automatizados" : "We build intelligent websites, business operating systems and automated businesses"}</h1>
        <p className="mt-3 text-lg text-ink-soft">{es ? "Para dueños que quieren crecer sin contratar a alguien para cada tarea: la IA atiende, agenda, da seguimiento y lleva las cuentas; su equipo hace el trabajo que importa." : "For owners who want to grow without hiring for every task: AI answers, books, follows up and keeps the books, while your team does the work that matters."}</p>
        <div className="mt-6 flex flex-wrap gap-3"><Link href="/book?service=automated-business" className="btn-primary">{es ? "Reservar consulta gratis" : "Book a free consultation"}</Link><Link href="/services?cat=business" className="btn-ghost">{es ? "Ver precios" : "See prices"}</Link></div>
      </div>

      <WeBuild es={es} />

      <section className="card bg-brand-tint">
        <h2 className="text-2xl font-bold">{es ? "La prueba: Handled funciona así" : "The proof: Handled runs this way"}</h2>
        <p className="mt-1 text-ink-soft">{es ? "Esta empresa funciona con su propio sistema operativo y agentes de IA. Es lo que construimos para usted." : "This company runs on its own operating system and AI agents. It's what we build for you."}</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">{proof.map((x) => <li key={x} className="flex gap-2 text-sm"><span className="font-bold text-brand">✓</span>{x}</li>)}</ul>
      </section>

      <section>
        <h2 className="text-2xl font-bold">{es ? "Cómo funciona" : "How it works"}</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-4">{steps.map(([n, t, d]) => <div key={n} className="card"><div className="text-xs font-bold text-brand">{n}</div><div className="font-semibold">{t}</div><p className="mt-1 text-sm text-ink-soft">{d}</p></div>)}</div>
      </section>

      <section>
        <h2 className="text-2xl font-bold">{es ? "También hacemos" : "We also do"}</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{others.map((s) => (
          <Link key={s.slug} href={`/services/${s.slug}`} className="card flex flex-col transition hover:border-brand"><div className="text-2xl">{s.icon}</div><div className="mt-2 font-semibold">{serviceText(es ? "es" : "en", s.slug, s).name}</div><p className="mt-1 flex-1 text-sm text-ink-soft">{serviceText(es ? "es" : "en", s.slug, s).tagline}</p><div className="mt-3 text-sm font-bold text-brand">{priceHint(s.slug, es ? "es" : "en")}</div></Link>
        ))}</div>
      </section>

      <section className="card text-center">
        <h2 className="text-2xl font-bold">{es ? "¿Qué haría con 20 horas más a la semana?" : "What would you do with 20 more hours a week?"}</h2>
        <p className="mt-1 text-ink-soft">{es ? "En una consulta de 30 minutos le mostramos qué se puede automatizar en su negocio y cuánto cuesta." : "In a 30-minute consultation we show you what can be automated in your business and what it costs."}</p>
        <Link href="/book?service=automated-business" className="btn-primary mt-4 inline-block">{es ? "Reservar consulta gratis" : "Book a free consultation"}</Link>
      </section>
    </div>
  );
}
