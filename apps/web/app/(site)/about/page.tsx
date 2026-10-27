/*
 * FILE    : apps/web/app/(site)/about/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_1500 UTC
 * PURPOSE : About us — the slogan, our mission statement, who we are, what we stand for (values), the company in numbers,
 *           why it works for customers and pros, and the ways to work with us. All words come from BRAND_STORY in @handled/core (change them there).
 *           English / Spanish.
 */
import Link from "next/link";
import { BRAND, BRAND_STORY, CATEGORIES, SERVICES } from "@handled/core";
import { getLocale } from "@/lib/locale";
import { WhyItWorks } from "@/components/home/WhyItWorks";

export const metadata = { title: "About us", description: BRAND_STORY.mission.en };

export default async function About() {
  const es = (await getLocale()) === "es";
  const L = es ? "es" : "en";
  const facts = [
    { n: `${SERVICES.length}`, l: es ? "servicios en un solo lugar" : "services in one place" },
    { n: `${CATEGORIES.length}`, l: es ? "categorías, del hogar al negocio" : "categories, home to business" },
    { n: "2", l: es ? "estados: Michigan y Washington" : "states: Michigan & Washington" },
    { n: `${BRAND.guaranteeDays}`, l: es ? "días de garantía en cada trabajo" : "days of guarantee on every job" },
  ];
  const doors = [
    { href: "/book", icon: "🧽", t: es ? "Reservar un servicio" : "Book a service", d: es ? "Precio al instante, profesional verificado" : "Instant price, vetted pro" },
    { href: "/business", icon: "🏢", t: es ? "Cuentas para empresas" : "Business accounts", d: es ? "Todas sus ubicaciones, un proveedor" : "Every location, one vendor" },
    { href: "/pros#apply", icon: "🧰", t: es ? "Hágase profesional" : "Become a Pro", d: es ? "Trabajos pagados, pago semanal" : "Paid jobs, weekly pay" },
    { href: "/partners#join", icon: "💸", t: es ? "Hágase socio" : "Become a Partner", d: es ? "Gane el 10% por cada cliente" : "Earn 10% on every customer" },
  ];
  return (
    <div>
      <section className="bg-brand-deep text-white">
        <div className="wrap py-16 sm:py-20">
          <div className="text-xs font-bold uppercase tracking-widest text-gold-light">{es ? "Quiénes somos" : "About us"}</div>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-6xl">{BRAND_STORY.slogan[L]}</h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-white/85 sm:text-xl"><span className="font-bold text-gold-light">{es ? "Nuestra misión: " : "Our mission: "}</span>{BRAND_STORY.mission[L]}</p>
        </div>
      </section>

      <section className="wrap grid gap-10 py-14 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{es ? "Quiénes somos" : "Who we are"}</h2>
          <div className="mt-4 space-y-4 text-lg leading-relaxed text-ink-soft">{BRAND_STORY.about[L].map((p) => <p key={p.slice(0, 24)}>{p}</p>)}</div>
        </div>
        <div className="grid grid-cols-2 content-start gap-3">
          {facts.map((f) => (
            <div key={f.l} className="card text-center">
              <div className="text-4xl font-extrabold text-brand">{f.n}</div>
              <div className="mt-1 text-sm text-ink-soft">{f.l}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-paper py-14">
        <div className="wrap">
          <h2 className="text-3xl font-bold tracking-tight">{es ? "Lo que defendemos" : "What we stand for"}</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BRAND_STORY.values.map((v) => (
              <div key={v.en.t} className="card">
                <div className="text-3xl">{v.icon}</div>
                <div className="mt-3 font-bold">{v[L].t}</div>
                <p className="mt-1 text-sm text-ink-soft">{v[L].d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <WhyItWorks es={es} />

      <section className="wrap py-14">
        <h2 className="text-3xl font-bold tracking-tight">{es ? "Trabaje con nosotros" : "Work with us"}</h2>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {doors.map((d) => (
            <Link key={d.href} href={d.href} className="card flex flex-col transition hover:border-brand">
              <span className="text-3xl">{d.icon}</span>
              <span className="mt-3 text-lg font-bold">{d.t}</span>
              <span className="mt-1 text-sm text-ink-soft">{d.d}</span>
            </Link>
          ))}
        </div>
        <p className="mt-8 text-sm text-ink-soft">{BRAND.legalName} · {BRAND.supportPhone} · <a className="underline" href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a> · {BRAND.partner}</p>
      </section>
    </div>
  );
}
