/*
 * FILE    : apps/web/app/(site)/services/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0212 UTC — sidebar layout chosen by the owner: categories on the left
 *           (tabs on phones), the chosen category's service cards on the right. New services
 *           and categories appear automatically from the catalog.
 */
import { CATEGORIES, SERVICES, categoryText, money, serviceText, t } from "@handled/core";
import { getLocale } from "@/lib/locale";
import { ServicesBrowser, type BrowserCategory } from "@/components/ServicesBrowser";

export const metadata = { title: "Services", description: "Every service we offer, by category, with upfront prices." };

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat } = await searchParams;
  const l = await getLocale();
  const categories: BrowserCategory[] = CATEGORIES.map((c) => ({
    id: c.id, name: categoryText(l, c.id, c).name, icon: c.icon, blurb: categoryText(l, c.id, c).blurb,
    services: SERVICES.filter((s) => s.category === c.id).map((s) => ({
      slug: s.slug, ...serviceText(l, s.slug, s), icon: s.icon, siteVisit: s.siteVisit,
      from: s.slug === "event-package" ? t(l, "By budget") : `${t(l, "from")} ${money(s.minimum)}`,
    })),
  })).filter((c) => c.services.length);
  return (
    <div className="wrap py-14">
      <h1 className="text-4xl font-extrabold tracking-tight">{t(l, "Services")}</h1>
      <p className="mt-2 text-ink-soft">{l === "es" ? "Precios por adelantado. Profesionales verificados. Una sola cuenta para todo." : "Upfront prices. Vetted pros. One account for all of it."}</p>
      <ServicesBrowser categories={categories} initial={cat} />
    </div>
  );
}
