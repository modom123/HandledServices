/*
 * FILE    : apps/web/app/(site)/services/[slug]/in/[city]/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : "<Service> in <City>" landing pages for search (every service × every city in
 *           SEO_CITIES), built on demand and cached for a day.
 * UPDATED : 2026-10-05_0419 UTC — search description: exact price in a minute (no "from $X").
 */
import { notFound } from "next/navigation";
import { BRAND, SEO_CITY_BY_SLUG, getService } from "@handled/core";
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
    description: `${s.tagline} Vetted, insured ${s.name.toLowerCase()} pros in ${c.name}. Your exact price online in about a minute. ${BRAND.promise}`,
    alternates: { canonical: `/services/${s.slug}/in/${c.slug}` },
  };
}

export default async function CityService({ params }: { params: Promise<{ slug: string; city: string }> }) {
  const { slug, city } = await params;
  const s = getService(slug), c = SEO_CITY_BY_SLUG[city];
  if (!s || !c) notFound();
  return <ServiceLanding s={s} city={c} reviews={await publicReviews({ slug: s.slug, limit: 5 })} locale={await getLocale()} />;
}
