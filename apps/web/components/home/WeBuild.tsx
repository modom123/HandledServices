/*
 * FILE    : apps/web/components/home/WeBuild.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-11_2307 UTC
 * PURPOSE : "We build" — Intelligent Websites, Business Operating Systems and Automated Businesses (Business & Technology
 *           services), with Handled itself as the proof. Used on both home page looks, the business page and /technology.
 *           English / Spanish.
 * UPDATED : 2026-10-23_1100 UTC — no prices on the pillars (Business & Technology is consultation-only); each card says Free consultation.
 */
import Link from "next/link";

export const BUILD_PILLARS = [
  {
    slug: "website-design", icon: "🌐",
    en: { t: "Intelligent Websites", d: "A website that works while you sleep: an AI assistant answers visitors, captures every lead and books appointments, and every inquiry gets a reply in seconds." },
    es: { t: "Sitios web inteligentes", d: "Un sitio que trabaja mientras usted duerme: un asistente de IA atiende a los visitantes, capta cada cliente potencial y agenda citas, y cada consulta recibe respuesta en segundos." },
  },
  {
    slug: "business-operating-system", icon: "🧠",
    en: { t: "Business Operating Systems", d: "One system that runs the company — customers, booking, scheduling, dispatch, invoicing and live dashboards — instead of ten apps and a spreadsheet." },
    es: { t: "Sistemas operativos para negocios", d: "Un solo sistema que maneja la empresa — clientes, reservas, horarios, despacho, facturación y paneles en vivo — en lugar de diez aplicaciones y una hoja de cálculo." },
  },
  {
    slug: "automated-business", icon: "🚀",
    en: { t: "Automated Businesses", d: "Website, operating system, AI agents and automations, built end to end — so leads are answered, work is scheduled and follow-ups go out without you." },
    es: { t: "Negocios automatizados", d: "Sitio web, sistema operativo, agentes de IA y automatizaciones, de principio a fin: los clientes reciben respuesta, el trabajo se agenda y el seguimiento sale sin usted." },
  },
] as const;

/** The three pillars as cards. `compact` = the home-page band; otherwise the full section. No prices: each is scoped on a free consultation. */
export function WeBuild({ es, compact = false }: { es: boolean; compact?: boolean }) {
  return (
    <section className={compact ? "border-y border-line bg-paper py-14" : "py-2"}>
      <div className={compact ? "wrap" : ""}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-brand">{es ? "Handled Tecnología" : "Handled Technology"}</div>
            <h2 className="mt-1 text-3xl font-bold tracking-tight">{es ? "Creamos negocios que funcionan solos" : "We build businesses that run themselves"}</h2>
            <p className="mt-2 max-w-2xl text-ink-soft">{es ? "Handled funciona con su propio sistema operativo y con IA: le construimos lo mismo a su negocio." : "Handled runs on its own AI-powered operating system. We build the same for your business."}</p>
          </div>
          <Link href="/technology" className="text-sm font-semibold text-brand">{es ? "Cómo lo hacemos →" : "How we do it →"}</Link>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {BUILD_PILLARS.map((p) => {
            const txt = es ? p.es : p.en;
            return (
              <Link key={p.slug} href={`/services/${p.slug}`} className="card flex flex-col transition hover:border-brand">
                <div className="text-3xl">{p.icon}</div>
                <div className="mt-3 text-lg font-bold">{txt.t}</div>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-ink/90">{txt.d}</p>
                <div className="mt-4 text-sm font-bold text-brand">{es ? "Consulta gratis →" : "Free consultation →"}</div>
              </Link>
            );
          })}
        </div>
        {!compact && <p className="mt-3 text-xs text-ink-soft">{es ? "Cada solución es distinta: el alcance y el precio se fijan en una consulta gratis por video." : "Every solution is different: scope and price are set on a free video consultation."}</p>}
      </div>
    </section>
  );
}
