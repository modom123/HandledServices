/*
 * FILE    : apps/web/app/(site)/services/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0212 UTC — sidebar layout chosen by the owner: categories on the left
 *           (tabs on phones), the chosen category's service cards on the right. New services
 *           and categories appear automatically from the catalog.
 * UPDATED : 2026-10-04_1950 UTC — lists show a typical job price ("typically $X"), not the minimum (every order is different).
 * UPDATED : 2026-10-28_1630 UTC — Business & Technology moved to its own page (/technology): left out of the list, with a link card;
 *           ?cat=business redirects there.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { CATEGORIES, SERVICES, categoryText, priceHint, serviceText, t } from "@handled/core";
import { getLocale } from "@/lib/locale";
import { ServicesBrowser, type BrowserCategory } from "@/components/ServicesBrowser";

export const metadata = { title: "Services", description: "Every service we offer, by category, with upfront prices." };

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat } = await searchParams;
  // Business & Technology is its own page (websites, AI and consulting don't belong among home services)
  if (cat === "business") redirect("/technology");
  const l = await getLocale();
  const es = l === "es";
  const biz = SERVICES.filter((s) => s.category === "business");
  const categories: BrowserCategory[] = CATEGORIES.filter((c) => c.id !== "business").map((c) => ({
    id: c.id, name: categoryText(l, c.id, c).name, icon: c.icon, blurb: categoryText(l, c.id, c).blurb,
    services: SERVICES.filter((s) => s.category === c.id).map((s) => ({
      slug: s.slug, ...serviceText(l, s.slug, s), icon: s.icon, siteVisit: s.siteVisit, remote: s.remote,
      from: priceHint(s.slug, l),
    })),
  })).filter((c) => c.services.length);
  return (
    <div className="wrap py-14">
      <h1 className="text-4xl font-extrabold tracking-tight">{t(l, "Services")}</h1>
      <p className="mt-2 text-ink-soft">{l === "es" ? "Precios por adelantado. Profesionales verificados. Una sola cuenta para todo." : "Upfront prices. Vetted pros. One account for all of it."}</p>
      <ServicesBrowser categories={categories} initial={cat} />
      <Link href="/technology" className="card mt-12 flex flex-wrap items-center gap-4 bg-brand-tint transition hover:border-brand">
        <span className="text-4xl">💼</span>
        <span className="min-w-60 flex-1">
          <span className="block text-xl font-bold">{es ? "¿Busca negocios y tecnología?" : "Looking for Business & Technology?"}</span>
          <span className="block text-ink/90">{es ? `Sitios web inteligentes, sistemas para negocios, agentes de IA, formación de empresas y consultoría: ${biz.length} servicios en su propia página, con consulta gratis.` : `Intelligent websites, business operating systems, AI agents, business formation and consulting: ${biz.length} services on their own page, with a free consultation.`}</span>
        </span>
        <span className="btn-primary">{es ? "Ver negocios y tecnología →" : "See Business & Technology →"}</span>
      </Link>
    </div>
  );
}
