/*
 * FILE    : apps/web/app/(site)/services/[slug]/in/[city]/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : "<Service> in <City>" landing pages for search (every service × every city in
 *           SEO_CITIES), built on demand and cached for a day.
 * UPDATED : 2026-10-05_0419 UTC — search description: exact price in a minute (no "from $X").
 * UPDATED : 2026-11-04_2230 UTC — SEO: only focus services' city pages are indexed; the rest are noindex,follow with the
 *           service page as canonical (they still work for visitors and ads). Washington cities added (WA_SEO_CITIES).
 * UPDATED : 2026-11-06_0500 UTC — indexed when the service is a focus service or one its market leads with (isIndexedCityPage).
 * UPDATED : 2026-11-09_1600 UTC — Business & Technology is consultation-only again: the search description says free consultation, not an online price.
 */
import { notFound } from "next/navigation";
import { BRAND, SEO_CITY_BY_SLUG, getService, isIndexedCityPage, consultOnly } from "@handled/core";
import { publicReviews } from "@/lib/reviews";
import { ServiceLanding } from "@/components/ServiceLanding";
import { getLocale } from "@/lib/locale";

// rendered per visit: the page follows the visitor's language (cookie) and shows live reviews
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; city: string }> }) {
  const { slug, city } = await params;
  const s = getService(slug), c = SEO_CITY_BY_SLUG[city];
  if (!s || !c) return {};
  return {
    title: `${s.name} in ${c.name}, ${c.state}`,
    description: `${s.tagline} Vetted, insured ${s.name.toLowerCase()} pros in ${c.name}. ${consultOnly(s.slug) ? "Custom solutions, scoped and priced on a free consultation." : "Your exact price online in about a minute."} ${BRAND.promise}`,
    // indexed: the focus services everywhere + what each market leads with (handyman in Las Vegas…); the rest noindex —
    // thousands of near-identical city pages read as doorway pages
    ...(isIndexedCityPage(s.slug, c.slug)
      ? { alternates: { canonical: `/services/${s.slug}/in/${c.slug}` } }
      : { alternates: { canonical: `/services/${s.slug}` }, robots: { index: false, follow: true } }),
  };
}

export default async function CityService({ params }: { params: Promise<{ slug: string; city: string }> }) {
  const { slug, city } = await params;
  const s = getService(slug), c = SEO_CITY_BY_SLUG[city];
  if (!s || !c) notFound();
  return <ServiceLanding s={s} city={c} reviews={await publicReviews({ slug: s.slug, limit: 5 })} locale={await getLocale()} />;
}
