/*
 * FILE    : apps/web/app/(site)/areas/[market]/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-06_0500 UTC
 * PURPOSE : One page per market we serve (/areas/las-vegas, /areas/new-york, /areas/new-jersey, /areas/michigan,
 *           /areas/washington): the "mini-site" for a local market, on the main domain so it shares the site's search
 *           standing, booking and checkout. The services the market leads with first (SITE_MARKETS.featured), its cities
 *           (each linking to "<service> in <city>"), how it works, and a book button. Ads, Google Business Profiles and
 *           print can point here.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { BRAND, SERVICES, SITE_MARKETS, SITE_MARKET_BY_SLUG, STATE_NAME, getService, priceHint, serviceText } from "@handled/core";
import { getLocale } from "@/lib/locale";
import { siteUrl } from "@/lib/site-url";

export const dynamicParams = false;
export const generateStaticParams = () => SITE_MARKETS.map((m) => ({ market: m.slug }));

export async function generateMetadata({ params }: { params: Promise<{ market: string }> }) {
  const m = SITE_MARKET_BY_SLUG[(await params).market];
  if (!m) return {};
  const lead = m.featured.map((x) => getService(x)?.name).filter(Boolean).slice(0, 3).join(", ");
  return {
    title: `${lead} in ${m.name}`,
    description: `${lead} and more across ${m.region}. Vetted, insured local pros, your exact price online in about a minute. ${BRAND.promise}`,
    alternates: { canonical: `/areas/${m.slug}` },
  };
}

export default async function MarketPage({ params }: { params: Promise<{ market: string }> }) {
  const m = SITE_MARKET_BY_SLUG[(await params).market];
  if (!m) notFound();
  const l = await getLocale();
  const es = l === "es";
  const featured = m.featured.map((x) => getService(x)).filter((s): s is NonNullable<typeof s> => Boolean(s));
  const home = m.cities[0];
  const more = SERVICES.filter((s) => !s.remote && s.category !== "business" && !m.featured.includes(s.slug)).slice(0, 18);
  const ld = {
    "@context": "https://schema.org", "@type": "WebPage", name: `${BRAND.name} — ${m.name}`, url: `${siteUrl()}/areas/${m.slug}`,
    about: { "@type": "HomeAndConstructionBusiness", "@id": `${siteUrl()}/#business`, name: BRAND.name, telephone: BRAND.supportPhone,
      areaServed: m.cities.map((c) => ({ "@type": "City", name: c.name, containedInPlace: { "@type": "State", name: STATE_NAME[c.state] ?? c.state } })) },
  };
  return (
    <div className="wrap py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <Link href="/areas" className="text-sm text-brand">← {es ? "Dónde trabajamos" : "Areas we serve"}</Link>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight">{featured.map((s) => s.name).slice(0, 2).join(es ? " y " : " & ")} {es ? "en" : "in"} {m.name}</h1>
      <p className="mt-3 max-w-3xl text-lg text-ink-soft">{m.intro}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={`/book?service=${featured[0]?.slug ?? ""}`} className="btn-primary">{es ? "Vea su precio y reserve" : "See your price & book"}</Link>
        <a href={`tel:${BRAND.supportPhone.replace(/[^\d+]/g, "")}`} className="btn-ghost">{BRAND.supportPhone}</a>
      </div>

      <h2 className="mt-12 text-2xl font-bold">{es ? `Lo más pedido en ${m.name}` : `Most booked in ${m.name}`}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {featured.map((s) => {
          const txt = serviceText(l, s.slug, s);
          return (
            <div key={s.slug} className="card">
              <div className="text-3xl">{s.icon}</div>
              <h3 className="mt-2 text-lg font-bold">{txt.name}</h3>
              <p className="mt-1 text-sm text-ink-soft">{txt.tagline}</p>
              <p className="mt-2 text-sm font-semibold">{priceHint(s.slug, l)}</p>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                {m.cities.map((c) => <Link key={c.slug} href={`/services/${s.slug}/in/${c.slug}`} className="text-brand hover:underline">{c.name}</Link>)}
              </div>
              <Link href={`/book?service=${s.slug}`} className="btn-primary mt-4 inline-block text-sm">{es ? "Reservar" : "Book"} {txt.name.toLowerCase()}</Link>
            </div>
          );
        })}
      </div>

      <h2 className="mt-12 text-2xl font-bold">{es ? "Cómo funciona" : "How it works"}</h2>
      <ol className="mt-4 grid gap-4 sm:grid-cols-3">
        {(es
          ? [["Responda unas preguntas", "Toma alrededor de un minuto. Vea su precio exacto antes de reservar."], ["Un profesional verificado hace el trabajo", "Con seguro y antecedentes verificados, de su zona."], ["Revisamos el trabajo", "Fotos al terminar; se cobra cuando está hecho."]]
          : [["Answer a few questions", "About a minute. See your exact price before you book."], ["A vetted local pro does the job", "Insured and background-checked, from your area."], ["We check the work", "Photos when it's done; you're charged when it's finished."]]
        ).map(([h, d], i) => <li key={h} className="card"><div className="text-sm font-bold text-brand">{i + 1}</div><div className="mt-1 font-semibold">{h}</div><p className="mt-1 text-sm text-ink-soft">{d}</p></li>)}
      </ol>

      <h2 className="mt-12 text-2xl font-bold">{es ? `Ciudades que atendemos en ${m.name}` : `Cities we serve in ${m.name}`}</h2>
      <p className="mt-2 text-sm text-ink-soft">{es ? `Y los vecindarios cercanos en ${m.region}. Escriba su código postal al reservar para ver si un profesional cubre su zona.` : `And nearby neighborhoods across ${m.region}. Enter your ZIP when you book to confirm a pro covers it.`}</p>
      <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
        {m.cities.map((c) => <li key={c.slug}><Link href={`/services/${featured[0]?.slug ?? "handyman"}/in/${c.slug}`} className="hover:text-brand">📍 {c.name}, {c.state}</Link></li>)}
      </ul>

      <h2 className="mt-12 text-2xl font-bold">{es ? "Más servicios" : "More services"}</h2>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {more.map((s) => <Link key={s.slug} href={home ? `/services/${s.slug}/in/${home.slug}` : `/services/${s.slug}`} className="rounded-full border border-line px-3 py-1 hover:border-brand">{s.icon} {serviceText(l, s.slug, s).name}</Link>)}
        <Link href="/services" className="rounded-full border border-brand px-3 py-1 font-semibold text-brand">{es ? `Los ${SERVICES.length} servicios →` : `All ${SERVICES.length} services →`}</Link>
      </div>
    </div>
  );
}
