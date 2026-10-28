/*
 * FILE    : apps/web/components/ServiceLanding.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : One service landing page, used for /services/<slug> and the city pages
 *           /services/<slug>/in/<city>: what's included, how pricing works, the questions we ask,
 *           real customer reviews, nearby cities, and search-engine markup (Service + rating).
 * UPDATED : 2026-10-04_1950 UTC — lists show a typical job price ("typically $X"), not the minimum (every order is different).
 * UPDATED : 2026-10-06_2010 UTC — no list of Michigan cities; a national service area (city pages still work for Google).
 * UPDATED : 2026-10-28_1630 UTC — the page ends in an order step ("Ready to book…?": 3 steps + the button) and related services;
 *           Business & Technology services speak in consultation terms (no on-site estimate, deposit or redo wording).
 * UPDATED : 2026-10-05_0419 UTC — no dollar figures on service pages: "exact and upfront, in about a minute" (every job is priced on its details).
 */
import Link from "next/link";
import { BRAND, CATEGORIES, SERVICES, categoryText, priceHint, serviceText, t as tr, type Locale, type SeoCity, type Service } from "@handled/core";
import { categoryHref } from "./site";
import type { PublicReview } from "@/lib/reviews";
import { siteUrl } from "@/lib/notify";

const stars = (n: number) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));

export function ServiceLanding({ s, city, reviews, locale = "en" }: { s: Service; city?: SeoCity; reviews: { count: number; average: number | null; list: PublicReview[] }; locale?: Locale }) {
  const txt = serviceText(locale, s.slug, s);
  const es = locale === "es";
  // Business & Technology (websites, AI, formation, consulting): a free video consultation, not an on-site job
  const tech = s.category === "business";
  const cat = CATEGORIES.find((c) => c.id === s.category);
  const related = SERVICES.filter((x) => x.category === s.category && x.slug !== s.slug).slice(0, 3);
  const book = `/book?service=${s.slug}`;
  const cta = tech ? (es ? "Reservar consulta gratis" : "Book a free consultation") : es ? tr(locale, "Get my price") : "Get my exact price";
  const steps = tech
    ? (es ? [["Cuéntenos de su negocio", "Unas preguntas rápidas sobre lo que necesita."], ["Consulta gratis por video", "Confirmamos el alcance y le damos un precio firme por escrito."], ["Lo construimos", "Lo probamos con usted antes de lanzarlo. Usted es dueño de todo."]]
      : [["Tell us about your business", "A few quick questions about what you need."], ["Free video consultation", "We confirm the scope and give you a firm price in writing."], ["We build it", "Tested with you before it goes live. You own everything."]])
    : (es ? [["Responda unas preguntas", "Toma alrededor de un minuto."], ["Vea su precio exacto y elija la hora", "Sin llamadas ni cargos sorpresa."], ["Un profesional verificado lo hace", "Con fotos de comprobación y repetición gratis si algo falta."]]
      : [["Answer a few questions", "It takes about a minute."], ["See your exact price and pick a time", "No callbacks, no surprise fees."], ["A vetted pro does the job", "With photo proof, and a free redo if anything's missed."]]);
  const where = city ? ` in ${city.name}, ${city.state}` : "";
  const ld = {
    "@context": "https://schema.org", "@type": "Service", name: `${s.name}${where}`, description: s.description, serviceType: s.name,
    provider: { "@type": "LocalBusiness", name: BRAND.name, telephone: BRAND.supportPhone, url: siteUrl(), ...(city ? { address: { "@type": "PostalAddress", addressLocality: city.name, addressRegion: city.state, postalCode: city.zip, addressCountry: "US" } } : {}) },
    areaServed: city ? { "@type": "City", name: `${city.name}, ${city.state}` } : { "@type": "Country", name: "United States" },
    ...(reviews.count >= 3 && reviews.average ? { aggregateRating: { "@type": "AggregateRating", ratingValue: reviews.average, reviewCount: reviews.count, bestRating: 5 } } : {}),
  };
  return (
    <div className="wrap grid gap-10 py-14 md:grid-cols-[1.4fr_1fr]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <div>
        <div className="text-5xl">{s.icon}</div>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight">{txt.name}{locale === "es" && city ? ` en ${city.name}, ${city.state}` : where}</h1>
        <p className="mt-2 text-lg text-brand">{txt.tagline}</p>
        {reviews.average && reviews.count >= 3 && <p className="mt-2 text-sm"><span className="text-amber-500">{stars(reviews.average)}</span> <b>{reviews.average}</b> from {reviews.count} customer reviews</p>}
        <p className="mt-5 text-ink-soft">{locale === "es" ? txt.tagline : s.description}{city ? ` We serve ${city.name} and nearby neighborhoods with vetted, insured local pros — book online with an upfront price.` : ""}</p>
        <h2 className="mt-10 font-bold">{locale === "es" ? "Qué incluye" : "What’s included"}</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {s.includes.map((i) => <li key={i} className="flex gap-2 text-sm"><span className="text-brand">✓</span>{tr(locale, i)}</li>)}
        </ul>
        <h2 className="mt-10 font-bold">{tech ? (es ? "Lo que le preguntaremos antes de la consulta" : "What we'll ask before your consultation") : es ? "Lo que le preguntaremos para su precio" : "Questions we’ll ask for your price"}</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-soft">
          {s.questions.map((q) => <li key={q.id}>{tr(locale, q.label)}{q.help ? <span className="block text-xs">{tr(locale, q.help)}</span> : null}</li>)}
        </ul>
        {reviews.list.length > 0 && (
          <>
            <h2 className="mt-10 font-bold">What customers say</h2>
            <div className="mt-3 space-y-3">
              {reviews.list.slice(0, 5).map((r) => (
                <div key={r.id} className="card p-4 text-sm"><div className="text-amber-500">{stars(r.rating)}</div><p className="mt-1">“{r.comment}”</p><div className="mt-1 text-xs text-ink-soft">{r.name}{r.city ? ` · ${r.city}` : ""} · {r.date}</div></div>
              ))}
            </div>
            <Link href="/reviews" className="mt-3 inline-block text-sm font-semibold text-brand">All reviews →</Link>
          </>
        )}
      </div>
      {/* phones: the closing "Ready to book" section below does this job (the card would sit right on top of it) */}
      <aside className="card hidden h-fit md:sticky md:top-24 md:block">
        {tech ? (
          <>
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{es ? "Empiece aquí" : "Start here"}</div>
            <div className="mt-1 text-2xl font-bold">{es ? "Consulta gratis por video" : "Free video consultation"}</div>
            <div className="mt-1 text-sm text-ink-soft">{es ? "Responda unas preguntas y elija una hora. Confirmamos el alcance y le damos un precio firme por escrito antes de empezar." : "Answer a few questions and pick a time. We confirm the scope and give you a firm price in writing before any work starts."}{/^(From|Desde) /.test(priceHint(s.slug, locale)) ? ` ${priceHint(s.slug, locale)}.` : ""}</div>
          </>
        ) : (
          <>
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Your price{where}</div>
            <div className="mt-1 text-2xl font-bold">Exact and upfront, in about a minute</div>
            <div className="mt-1 text-sm text-ink-soft">Answer a few questions about your job and see the full price before you book — no callbacks, no surprise fees{s.frequencies.length > 1 ? " · save up to 20% on a plan" : ""}.</div>
          </>
        )}
        {(s.slug === "junk-removal" || s.slug === "large-item-removal") && (
          <Link href="/services/junk-container" className="mt-3 block rounded-xl border border-line p-3 text-sm hover:border-brand">🗑️ <b>Rather load it yourself over a week?</b> We drop off a container and pick it up.</Link>
        )}
        {s.slug === "junk-container" && (
          <Link href="/services/junk-removal" className="mt-3 block rounded-xl border border-line p-3 text-sm hover:border-brand">🚛 <b>Want us to do the lifting?</b> Book full-service Junk Removal instead.</Link>
        )}
        {s.siteVisit && !tech && <p className="mt-3 rounded-xl bg-brand-tint p-3 text-sm text-brand-dark">Free on-site estimate — a pro confirms the firm price before any work.</p>}
        <Link href={book} className="btn-primary mt-5 w-full py-3">{cta}</Link>
        <p className="mt-4 text-xs text-ink-soft">{tech ? (es ? "Usted es dueño de todo: el sitio, los datos, las cuentas y los accesos." : "You own everything: the site, the data, the accounts and the logins.") : BRAND.promise}</p>
      </aside>

      {/* the end of the page leads into ordering, so nobody has to scroll back up */}
      <section className="card bg-brand-tint md:col-span-2">
        <h2 className="text-2xl font-bold">{es ? `¿Listo para reservar: ${txt.name}?` : `Ready to book ${txt.name}?`}</h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-3">{steps.map(([t, d], i) => (
          <li key={t} className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-deep text-sm font-bold text-white">{i + 1}</span><span><span className="block font-semibold">{t}</span><span className="block text-sm text-ink-soft">{d}</span></span></li>
        ))}</ol>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link href={book} className="btn-primary px-8 py-3 text-base">{cta}</Link>
          <span className="text-sm text-ink-soft">{es ? "¿Preguntas? Llame al" : "Questions? Call"} <a href={`tel:${BRAND.supportPhone.replace(/[^\d+]/g, "")}`} className="font-semibold text-ink">{BRAND.supportPhone}</a></span>
        </div>
      </section>

      {related.length > 0 && cat && (
        <section className="md:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-xl font-bold">{es ? "También le puede interesar" : "You might also need"}</h2>
            <Link href={categoryHref(cat.id)} className="text-sm font-semibold text-brand">{es ? "Todo en" : "All of"} {categoryText(locale, cat.id, cat).name} →</Link>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">{related.map((r) => (
            <Link key={r.slug} href={`/services/${r.slug}`} className="card flex flex-col transition hover:border-brand"><div className="text-2xl">{r.icon}</div><div className="mt-2 font-semibold">{serviceText(locale, r.slug, r).name}</div><p className="mt-1 flex-1 text-sm text-ink-soft">{serviceText(locale, r.slug, r).tagline}</p><div className="mt-2 text-sm font-bold text-brand">{priceHint(r.slug, locale)}</div></Link>
          ))}</div>
        </section>
      )}
    </div>
  );
}
