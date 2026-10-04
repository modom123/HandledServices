/*
 * FILE    : apps/web/components/ServiceLanding.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : One service landing page, used for /services/<slug> and the city pages
 *           /services/<slug>/in/<city>: what's included, typical price, the questions we ask,
 *           real customer reviews, nearby cities, and search-engine markup (Service + rating).
 * UPDATED : 2026-10-04_1950 UTC — lists show a typical job price ("typically $X"), not the minimum (every order is different).
 */
import Link from "next/link";
import { BRAND, SEO_CITIES, defaultAnswers, estimate, getService, money, moneyRange, serviceText, t as tr, type Locale, type SeoCity, type Service } from "@handled/core";
import type { PublicReview } from "@/lib/reviews";
import { siteUrl } from "@/lib/notify";

const stars = (n: number) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));

export function ServiceLanding({ s, city, reviews, locale = "en" }: { s: Service; city?: SeoCity; reviews: { count: number; average: number | null; list: PublicReview[] }; locale?: Locale }) {
  const txt = serviceText(locale, s.slug, s);
  const typical = estimate({ slug: s.slug, answers: defaultAnswers(s) });
  const where = city ? ` in ${city.name}, ${city.state}` : "";
  const ld = {
    "@context": "https://schema.org", "@type": "Service", name: `${s.name}${where}`, description: s.description, serviceType: s.name,
    provider: { "@type": "LocalBusiness", name: BRAND.name, telephone: BRAND.supportPhone, url: siteUrl(), ...(city ? { address: { "@type": "PostalAddress", addressLocality: city.name, addressRegion: city.state, postalCode: city.zip, addressCountry: "US" } } : {}) },
    areaServed: city ? { "@type": "City", name: `${city.name}, ${city.state}` } : SEO_CITIES.map((c) => `${c.name}, ${c.state}`),
    offers: { "@type": "Offer", priceCurrency: "USD", price: String(s.minimum), description: `From ${money(s.minimum)}` },
    ...(reviews.count >= 3 && reviews.average ? { aggregateRating: { "@type": "AggregateRating", ratingValue: reviews.average, reviewCount: reviews.count, bestRating: 5 } } : {}),
  };
  return (
    <div className="wrap grid gap-10 py-14 md:grid-cols-[1.4fr_1fr]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
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
        <h2 className="mt-10 font-bold">{locale === "es" ? "Lo que le preguntaremos para su precio" : "Questions we’ll ask for your price"}</h2>
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
        <h2 className="mt-10 font-bold">{s.name} near you</h2>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {SEO_CITIES.filter((c) => c.slug !== city?.slug).map((c) => <Link key={c.slug} href={`/services/${s.slug}/in/${c.slug}`} className="rounded-full border border-line bg-white px-3 py-1 hover:border-brand">{c.name}</Link>)}
        </div>
      </div>
      <aside className="card h-fit md:sticky md:top-24">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Typical price{where}</div>
        <div className="mt-1 text-3xl font-bold">{moneyRange(typical.low, typical.high)}</div>
        <div className="mt-1 text-sm text-ink-soft">For a typical job. Yours is priced on your details in about a minute{s.frequencies.length > 1 ? " · save up to 20% on a plan" : ""}.</div>
        {(s.slug === "junk-removal" || s.slug === "large-item-removal") && (
          <Link href="/services/junk-container" className="mt-3 block rounded-xl border border-line p-3 text-sm hover:border-brand">🗑️ <b>Rather load it yourself over a week?</b> We drop off a container and pick it up — from {money(getService("junk-container")?.minimum ?? 349)}.</Link>
        )}
        {s.slug === "junk-container" && (
          <Link href="/services/junk-removal" className="mt-3 block rounded-xl border border-line p-3 text-sm hover:border-brand">🚛 <b>Want us to do the lifting?</b> Book full-service Junk Removal instead.</Link>
        )}
        {s.siteVisit && <p className="mt-3 rounded-xl bg-brand-tint p-3 text-sm text-brand-dark">Free on-site estimate — a pro confirms the firm price before any work.</p>}
        <Link href={`/book?service=${s.slug}`} className="btn-primary mt-5 w-full py-3">{locale === "es" ? tr(locale, "Get my price") : "Get my exact price"}</Link>
        <p className="mt-4 text-xs text-ink-soft">{BRAND.promise}</p>
      </aside>
    </div>
  );
}
