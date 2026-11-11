/*
 * FILE    : apps/web/app/(site)/home/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-07_0235 UTC — three switchable looks (lib/theme.ts): Modern uses components/home/HomeModern; Original and
 *           Green-white-gold share components/home/HomeClassic (colors come from the theme).
 * UPDATED : 2026-11-09_0330 UTC — the Professional look ("pro") uses components/home/pro/HomePro.
 * PURPOSE : Home page (the first page after the splash).
 * UPDATED : 2026-11-04_2230 UTC — SEO: this is the main page search engines index (the splash at / points here as its
 *           canonical): its own title and description naming Michigan & Washington, and the business as structured data.
 * UPDATED : 2026-11-10_2000 UTC — "New pros in the Handled Network" chain under every look (opt-in pros, refreshed every 6 hours).
 * UPDATED : 2026-11-10_0430 UTC — "insured pros" → "background-checked, vetted pros" (insurance is only required for services that need it).
 */
import type { Metadata } from "next";
import { BRAND } from "@handled/core";
import { getTheme } from "@/lib/theme";
import { HomeClassic } from "@/components/home/HomeClassic";
import { HomeModern } from "@/components/home/HomeModern";
import { HomePro } from "@/components/home/pro/HomePro";
import { businessLd, ldScript } from "@/lib/business-ld";
import { getLocale } from "@/lib/locale";
import { featuredPros } from "@/lib/showcase";
import { NewProsChain } from "@/components/NewProsChain";

export const metadata: Metadata = {
  title: { absolute: `${BRAND.name} — Home & business services in Michigan & Washington` },
  description: "Cleaning, repairs, painting, lawn and snow, moving, hauling and 100+ more home and business services in Michigan, New York, New Jersey, Las Vegas and Washington. Upfront prices, background-checked, vetted pros, and work checked with photos.",
  alternates: { canonical: "/home" },
};

export default async function Home() {
  const [theme, locale, pros] = await Promise.all([getTheme(), getLocale(), featuredPros()]);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={ldScript(businessLd())} />
      {theme === "pro" ? <HomePro /> : theme === "modern" ? <HomeModern /> : <HomeClassic />}
      <NewProsChain pros={pros} es={locale === "es"} />
    </>
  );
}
